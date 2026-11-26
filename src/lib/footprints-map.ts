import { Map as GlobeMap, setWorkerCount, setWorkerUrl, type ExpressionSpecification, type SkySpecification, type StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type * as GeoJSON from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { FOOTPRINT_LEVEL_COUNT, isFootprintData } from "./footprints";
import { attachGlobeRotation } from "./globe-rotation";
import { attachBasemap, MAP_GLYPHS } from "./footprints-basemap";

const HOME: [number, number] = [105, 23.44];
const HOME_BEARING = 0;
const number = new Intl.NumberFormat("en");
const distance = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ease = (t: number) => 1 - (1 - t) ** 4;

function palette(root: HTMLElement) {
  const style = getComputedStyle(root);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  // Let the browser resolve shared OKLCH/color-mix tokens to MapLibre-compatible sRGB.
  const read = (name: string) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = style.getPropertyValue(`--${name}`).trim();
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  };
  return { background: read("color-surface"), ocean: read("footprints-ocean"), land: read("color-surface-raised"),
    border: read("footprints-border"), text: read("color-text"), grid: read("color-primary"), point: read("color-accent"), halo: read("color-surface-raised"),
    terrainHighlight: read("footprints-terrain-highlight") };
}

function skyStyle(colors: ReturnType<typeof palette>): SkySpecification {
  return { "sky-color": colors.background, "horizon-color": colors.background,
    "fog-color": colors.ocean, "fog-ground-blend": 0.08, "horizon-fog-blend": 0.1,
    "atmosphere-blend": 0 };
}

function graticule(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const add = (coordinates: number[][]) => lines.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } });
  for (let lng = -180; lng < 180; lng += 30) {
    add(Array.from({ length: 73 }, (_, i) => [lng, -90 + i * 2.5]));
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    add(Array.from({ length: 145 }, (_, i) => [-180 + i * 2.5, lat]));
  }
  return { type: "FeatureCollection", features: lines };
}

function mapStyle(root: HTMLElement, data: GeoJSON.FeatureCollection): StyleSpecification {
  const colors = palette(root);
  const weight: ExpressionSpecification = ["/", ["-", ["get", "level"], 1], FOOTPRINT_LEVEL_COUNT - 1];
  // Keep dense areas compact until zooming in separates nearby cells.
  const radius: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"],
    0, ["+", 0.35, ["*", weight, 0.3]],
    4, ["+", 0.7, ["*", weight, 0.65]],
    6, ["+", 1, ["*", weight, 1.2]],
    8, ["+", 1.6, ["*", weight, 2.6]],
    9, ["+", 2.2, ["*", weight, 4.4]]];
  return {
    version: 8,
    projection: { type: "globe" },
    glyphs: MAP_GLYPHS,
    transition: { duration: 240, delay: 0 },
    sky: skyStyle(colors),
    sources: {
      countries: { type: "geojson", data: "/maps/countries-50m.json", tolerance: 0.6 },
      grid: { type: "geojson", data: graticule() },
      footprints: { type: "geojson", data, maxzoom: 9 },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": colors.ocean } },
      { id: "countries", type: "fill", source: "countries", paint: { "fill-color": colors.land } },
      { id: "borders", type: "line", source: "countries", paint: {
        "line-color": colors.border, "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.35, 5, 0.8], "line-opacity": 0.65,
      } },
      { id: "grid", type: "line", source: "grid", paint: { "line-color": colors.grid,
        "line-width": 0.5, "line-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.3, 4, 0] } },
      { id: "footprints", type: "circle", source: "footprints", paint: {
        "circle-color": colors.point, "circle-radius": radius, "circle-opacity": 0.7,
        "circle-stroke-color": colors.halo,
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 2, 0],
        "circle-stroke-opacity": 0.95,
      } },
    ],
  };
}

export async function mountFootprints(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-footprints]");
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted = "true";
  const find = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector<T>(`[data-${name}]`)!;
  const abort = new AbortController();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const smallScreen = matchMedia("(max-width: 760px)");
  const container = find("map");
  const homeZoom = () => Math.log2(Math.min(container.clientWidth * (smallScreen.matches ? 0.84 : 0.56),
    container.clientHeight * (smallScreen.matches ? 0.53 : 0.74)) / 163);
  const status = find("status");
  const selection = find("selection");
  const controls = root.querySelectorAll<HTMLButtonElement>("[data-map-action]");
  let map: GlobeMap | undefined;
  let themeObserver: MutationObserver | undefined;
  let updateBasemapTheme: (() => void) | undefined;
  let selectedId: number | string | undefined;
  let dataReady = false;

  const showStatus = (message: string) => {
    status.hidden = false;
    status.dataset.error = "true";
    find("status-message").textContent = message;
    find("retry").hidden = false;
  };
  const clearSelection = () => {
    if (selectedId !== undefined) map?.setFeatureState({ source: "footprints", id: selectedId }, { selected: false });
    selectedId = undefined;
    selection.hidden = true;
  };
  find("close-selection").addEventListener("click", clearSelection, { signal: abort.signal });
  find("retry").addEventListener("click", () => location.reload(), { signal: abort.signal });
  controls.forEach((button) => { button.disabled = true; });

  addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    abort.abort();
    themeObserver?.disconnect();
    map?.remove();
  }, { signal: abort.signal });
  addEventListener("pageshow", () => map?.resize(), { signal: abort.signal });

  try {
    const response = await fetch("/footprints/annual.json", { signal: abort.signal });
    if (!response.ok) throw new Error("足迹数据暂未准备好");
    const data: unknown = await response.json();
    if (!isFootprintData(data)) throw new Error("足迹数据暂时无法读取");
    dataReady = true;
    const years = [...data.years].sort((a, b) => a.year - b.year);
    const entries = [{ year: 0, records: years.reduce((sum, entry) => sum + entry.records, 0),
      distanceMeters: years.reduce((sum, entry) => sum + entry.distanceMeters, 0) }, ...years];
    const range = `${years[0].year} — ${years.at(-1)!.year}`;
    const highestDistance = Math.max(1, ...years.map(({ distanceMeters }) => distanceMeters));
    const timeline = find("years");
    const buttons: HTMLButtonElement[] = [];

    const chooseStats = (year: number) => {
      const entry = entries.find((entry) => entry.year === year)!;
      for (const button of buttons) button.setAttribute("aria-pressed", String(Number(button.dataset.year) === year));
      find("distance").textContent = distance.format(entry.distanceMeters / 1000);
      find("distance-label").textContent = year ? "年度距离 · km" : "总距离 · km";
      find("records").textContent = number.format(entry.records);
      find("records-label").textContent = year ? "年度记录点" : "总记录点";
      find("period").textContent = year ? `${year} / YEARLY TOTALS` : `${range} / ALL YEARS`;
      find("year-label").textContent = year ? `${year} 年统计` : "累计统计";
    };

    for (const { year, distanceMeters } of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-ghost";
      button.dataset.year = String(year);
      button.setAttribute("aria-label", year ? `查看 ${year} 年统计` : "查看累计统计");
      const bar = document.createElement("span");
      bar.className = "footprints-year-bar";
      bar.style.setProperty("--activity", String(year ? Math.max(0.08, Math.sqrt(distanceMeters / highestDistance)) : 1));
      const label = document.createElement("span");
      label.textContent = year ? String(year) : "全部";
      button.append(bar, label);
      button.addEventListener("click", () => chooseStats(year), { signal: abort.signal });
      buttons.push(button);
    }
    timeline.replaceChildren(...buttons);
    chooseStats(0);

    const features: GeoJSON.Feature<GeoJSON.Point>[] = data.points.map(([lng, lat, level]) => ({
      type: "Feature", properties: { level }, geometry: { type: "Point", coordinates: [lng, lat] },
    }));
    features.forEach((feature, id) => { feature.id = id; });
    setWorkerCount(2);
    setWorkerUrl(workerUrl);
    map = new GlobeMap({
      container,
      style: mapStyle(root, { type: "FeatureCollection", features }),
      center: HOME, zoom: homeZoom(), bearing: HOME_BEARING,
      minZoom: -0.5, maxZoom: 9, maxPitch: 0,
      localIdeographFontFamily: '"Noto Sans SC", sans-serif',
      dragRotate: false, touchPitch: false, attributionControl: false,
      pixelRatio: Math.min(devicePixelRatio, 2),
      canvasContextAttributes: { antialias: true },
      fadeDuration: reducedMotion.matches ? 0 : 180,
    });
    const globe = map;
    globe.touchZoomRotate.disableRotation();
    globe.getCanvas().setAttribute("aria-label", "足迹地球，方向键移动，加减键缩放");

    const adjustViewport = () => {
      const desktop = !smallScreen.matches;
      globe.setPadding({ left: desktop ? Math.min(container.clientWidth * 0.23, 330) : 0,
        right: 0, top: desktop ? 0 : 100, bottom: desktop ? 95 : 90 });
    };
    adjustViewport();
    globe.on("resize", adjustViewport);
    smallScreen.addEventListener("change", adjustViewport, { signal: abort.signal });

    globe.on("load", () => {
      status.hidden = true;
      root.dataset.ready = "true";
      controls.forEach((button) => { button.disabled = false; });
      attachGlobeRotation(globe, { signal: abort.signal,
        home: () => ({ latitude: HOME[1], zoom: homeZoom(), bearing: HOME_BEARING }),
        canRotate: () => status.hidden === true, onResume: clearSelection });
      if (new URLSearchParams(location.search).get("basemap") !== "local") {
        updateBasemapTheme = attachBasemap(globe, root, () => palette(root), abort.signal);
      }
    });
    globe.on("error", (event) => {
      console.warn("Footprints map:", event.error);
      const source = "sourceId" in event ? event.sourceId : undefined;
      if (!root.dataset.ready || source === "countries" || source === "footprints") {
        showStatus("地图暂时未能加载，请再试一次");
      }
    });
    globe.on("webglcontextlost", () => showStatus("地图显示已暂停，正在等待恢复"));
    globe.on("webglcontextrestored", () => { status.hidden = true; });
    globe.on("zoomend", () => { root.dataset.exploring = String(globe.getZoom() > 2.8); });
    globe.on("mousemove", "footprints", () => { globe.getCanvas().style.cursor = "pointer"; });
    globe.on("mouseleave", "footprints", () => { globe.getCanvas().style.cursor = ""; });
    globe.on("click", (event) => {
      if (!root.dataset.ready) return;
      const { x, y } = event.point;
      const point = globe.queryRenderedFeatures([[x - 8, y - 8], [x + 8, y + 8]], { layers: ["footprints"] })[0];
      clearSelection();
      if (!point || point.geometry.type !== "Point") return;
      selectedId = point.id;
      if (selectedId !== undefined) globe.setFeatureState({ source: "footprints", id: selectedId }, { selected: true });
      const [longitude, latitude] = point.geometry.coordinates;
      const country = globe.queryRenderedFeatures(globe.project([longitude, latitude]), { layers: ["countries"] })[0];
      find("selection-title").textContent = country?.properties.name ?? "所选区域";
      find("selection-level").textContent = String(point.properties.level);
      selection.hidden = false;
      globe.easeTo({ center: [longitude, latitude], zoom: Math.max(globe.getZoom(), 4),
        duration: reducedMotion.matches ? 0 : 700, easing: ease });
    });

    for (const button of controls) {
      button.addEventListener("click", () => {
        const duration = reducedMotion.matches ? 0 : 500;
        if (button.dataset.mapAction === "home") {
          clearSelection();
          globe.easeTo({ center: HOME, zoom: homeZoom(), bearing: HOME_BEARING, pitch: 0, duration, easing: ease });
        } else {
          globe.easeTo({ zoom: globe.getZoom() + (button.dataset.mapAction === "in" ? 1 : -1), duration, easing: ease });
        }
      }, { signal: abort.signal });
    }

    themeObserver = new MutationObserver(() => {
      const colors = palette(root);
      if (!globe.getLayer("ocean")) return;
      globe.setPaintProperty("ocean", "background-color", colors.ocean);
      globe.setPaintProperty("countries", "fill-color", colors.land);
      globe.setPaintProperty("borders", "line-color", colors.border);
      globe.setPaintProperty("grid", "line-color", colors.grid);
      globe.setPaintProperty("footprints", "circle-color", colors.point);
      globe.setPaintProperty("footprints", "circle-stroke-color", colors.halo);
      globe.setSky(skyStyle(colors));
      updateBasemapTheme?.();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  } catch (error) {
    if (abort.signal.aborted) return;
    showStatus(!dataReady && error instanceof Error ? "足迹数据暂时无法读取，请稍后重试" : "当前浏览器暂时无法显示地球");
  }
}
