import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parse } from "csv-parse";
import { cellToBoundary, cellToLatLng, latLngToCell } from "h3-js";
import { FOOTPRINT_LEVEL_COUNT, FOOTPRINT_RESOLUTION, type FootprintData, type FootprintPoint } from "../src/lib/footprints.ts";

// Empirically matches the app's displayed total; distances are already in metres.
const MAX_SEGMENT_DISTANCE_METERS = 10_000;
// Use logarithmic levels below the cap; all cells with 100+ samples look alike.
const MAX_CELL_RECORDS = 100;

function footprintLevel(count: number): number {
  if (count >= MAX_CELL_RECORDS) return FOOTPRINT_LEVEL_COUNT;
  const weight = Math.log((count + 1) / 2) / Math.log((MAX_CELL_RECORDS + 1) / 2);
  return 1 + Math.floor(weight * (FOOTPRINT_LEVEL_COUNT - 1));
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    exclude: { type: "string" }, output: { type: "string" },
    "from-year": { type: "string" },
  },
});
if (positionals.length !== 1) {
  throw new Error("用法：pnpm footprints:import <CSV> [--from-year 起始年份] [--exclude 私有排除区域.json] [--output 输出路径]");
}
const fromYear = values["from-year"] === undefined ? 1970 : Number(values["from-year"]);
if (!Number.isInteger(fromYear) || fromYear < 1970 || fromYear > 9999) {
  throw new Error("起始年份必须是 1970–9999 之间的整数。");
}
interface Exclusion { longitude: number; latitude: number; radiusKm: number }
const exclusions: Exclusion[] = [];
if (values.exclude) {
  const input: unknown = JSON.parse(await readFile(values.exclude, "utf8"));
  if (!Array.isArray(input)) throw new Error("排除区域必须是数组。");
  for (const area of input) {
    if (!area || typeof area !== "object"
      || !Number.isFinite(area.longitude) || Math.abs(area.longitude) > 180
      || !Number.isFinite(area.latitude) || Math.abs(area.latitude) > 90
      || !Number.isFinite(area.radiusKm) || area.radiusKm <= 0) {
      throw new Error("排除区域需要有效的 longitude、latitude 和正数 radiusKm。");
    }
    exclusions.push(area as Exclusion);
  }
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radians = Math.PI / 180;
  const a = Math.sin((lat1 - lat2) * radians / 2) ** 2
    + Math.cos(lat1 * radians) * Math.cos(lat2 * radians)
    * Math.sin((lng1 - lng2) * radians / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, a)));
}

const excludedCells = new Map<string, boolean>();
function isExcluded(cell: string): boolean {
  if (!exclusions.length) return false;
  const cached = excludedCells.get(cell);
  if (cached !== undefined) return cached;
  const [lat, lng] = cellToLatLng(cell);
  // Remove the whole intersecting cell, including points outside the private circle.
  const radius = Math.max(...cellToBoundary(cell).map(([y, x]) => distanceKm(lat, lng, y, x))) * 1.01;
  const excluded = exclusions.some((area) => distanceKm(lat, lng, area.latitude, area.longitude) <= radius + area.radiusKm);
  excludedCells.set(cell, excluded);
  return excluded;
}

const yearFormatter = new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric" });
const years = new Map<number, { records: number; distanceMeters: number }>();
const cells = new Map<string, number>();
let accepted = 0;
let skipped = 0;
let beforeStart = 0;
const parser = createReadStream(positionals[0]).pipe(parse({
  bom: true, skip_empty_lines: true, trim: true,
  columns: (header: string[]) => {
    if (!["dataTime", "longitude", "latitude", "distance"].every((name) => header.includes(name))) {
      throw new Error("CSV 需要 dataTime、longitude、latitude 和 distance 字段。");
    }
    return header;
  },
}));

for await (const value of parser) {
  const row = value as Record<string, string>;
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  const timestamp = Number(row.dataTime);
  const accuracy = Number(row.accuracy);
  const date = new Date(timestamp * 1000);
  if (!row.latitude || !row.longitude || !row.dataTime
    || !Number.isFinite(latitude) || Math.abs(latitude) > 90
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180
    || !Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1970
    || date.getUTCFullYear() > 9999) {
    skipped++;
    continue;
  }
  const year = Number(yearFormatter.format(date));
  if (year < fromYear) { skipped++; beforeStart++; continue; }
  const cell = latLngToCell(latitude, longitude, FOOTPRINT_RESOLUTION);
  if (year > 9999 || isExcluded(cell)) { skipped++; continue; }
  const entry = years.get(year) ?? { records: 0, distanceMeters: 0 };
  years.set(year, entry);
  const distance = Number(row.distance);
  // The map's accuracy filter must not change the app-compatible mileage total.
  if (Number.isFinite(distance) && distance > 0 && distance < MAX_SEGMENT_DISTANCE_METERS) {
    entry.distanceMeters += distance;
  }
  if (accuracy > 1000) { skipped++; continue; }
  cells.set(cell, Math.min(MAX_CELL_RECORDS, (cells.get(cell) ?? 0) + 1));
  entry.records++;
  accepted++;
}

if (!accepted) throw new Error("没有可导出的记录，请检查 CSV 字段或排除规则。");

const data: FootprintData = {
  version: 4,
  resolution: FOOTPRINT_RESOLUTION,
  points: [...cells].sort(([a], [b]) => a.localeCompare(b)).map(([cell, count]): FootprintPoint => {
    const [latitude, longitude] = cellToLatLng(cell);
    return [Number(longitude.toFixed(3)), Number(latitude.toFixed(3)), footprintLevel(count)];
  }),
  years: [...years].filter(([, entry]) => entry.records > 0 || entry.distanceMeters > 0)
    .sort(([a], [b]) => a - b).map(([year, { records, distanceMeters }]) => ({
      year,
      records,
      distanceMeters: Number(distanceMeters.toFixed(3)),
    })),
};
const output = values.output ? resolve(values.output)
  : fileURLToPath(new URL("../public/footprints/annual.json", import.meta.url));
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(data));
console.log(`地图已导出 ${accepted.toLocaleString("en")} 条记录，${data.years.length} 个年份；排除 ${skipped.toLocaleString("en")} 条。`);
if (beforeStart) console.log(`其中 ${beforeStart.toLocaleString("en")} 条早于 ${fromYear} 年。`);
console.log(`累计距离 ${(data.years.reduce((sum, entry) => sum + entry.distanceMeters, 0) / 1000).toFixed(2)} km（单段不足 10 km）。`);
console.log(`r${FOOTPRINT_RESOLUTION} 聚合数据（${FOOTPRINT_LEVEL_COUNT} 档对数强度，${MAX_CELL_RECORDS} 条封顶）：${output}`);
