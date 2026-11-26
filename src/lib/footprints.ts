export const FOOTPRINT_RESOLUTION = 7;
export const FOOTPRINT_LEVEL_COUNT = 8;

export type FootprintPoint = [longitude: number, latitude: number, level: number];

export interface FootprintYear {
  year: number;
  distanceMeters: number;
  records: number;
}

export interface FootprintData {
  version: 4;
  resolution: typeof FOOTPRINT_RESOLUTION;
  points: FootprintPoint[];
  years: FootprintYear[];
}

export function isFootprintData(value: unknown): value is FootprintData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<FootprintData>;
  return data.version === 4 && data.resolution === FOOTPRINT_RESOLUTION && Object.keys(data).length === 4
    && Array.isArray(data.points) && data.points.length > 0
    && data.points.every((point) => Array.isArray(point)
      && point.length === 3 && Number.isFinite(point[0]) && Math.abs(point[0]) <= 180
      && Number.isFinite(point[1]) && Math.abs(point[1]) <= 90
      && Number.isInteger(point[2]) && point[2] >= 1 && point[2] <= FOOTPRINT_LEVEL_COUNT)
    && Array.isArray(data.years)
    && data.years.length > 0
    && new Set(data.years.map((entry) => entry?.year)).size === data.years.length
    && data.years.every((entry) => entry && Object.keys(entry).length === 3 && Number.isInteger(entry.year)
      && entry.year >= 1970 && entry.year <= 9999
      && typeof entry.distanceMeters === "number" && Number.isFinite(entry.distanceMeters) && entry.distanceMeters >= 0
      && Number.isSafeInteger(entry.records) && entry.records >= 0);
}
