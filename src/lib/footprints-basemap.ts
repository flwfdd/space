import type { ExpressionSpecification, LayerSpecification, Map, MapEventType } from "maplibre-gl";

const HOST = "https://tiles.versatiles.org";
const SOURCE = "detail-map";
const ELEVATION = "detail-elevation";
const TERRAIN_MIN_ZOOM = 2.75;
export const MAP_GLYPHS = `${HOST}/assets/glyphs/{fontstack}/{range}.pbf`;

interface Colors { land: string; ocean: string; border: string; text: string; terrainHighlight: string }

function layers(colors: Colors, ready: boolean): LayerSpecification[] {
  const opacity = ready ? 1 : 0;
  const name: ExpressionSpecification = ["coalesce", ["get", "name_zh-Hans"], ["get", "name_zh"], ["get", "name"], ["get", "name_en"]];
  const text = { "text-field": name, "text-font": ["noto_sans_regular"], "text-padding": 10, "text-max-width": 9 };
  const labelPaint = { "text-color": colors.text, "text-halo-color": colors.land,
    "text-halo-width": 1.3, "text-halo-blur": 0.5, "text-opacity": opacity * 0.75 };
  return [
    { id: "detail-land", type: "background", paint: { "background-color": colors.land, "background-opacity": opacity } },
    { id: "detail-ocean", type: "fill", source: SOURCE, "source-layer": "ocean",
      paint: { "fill-color": colors.ocean, "fill-opacity": opacity } },
    { id: "detail-water", type: "fill", source: SOURCE, "source-layer": "water_polygons", minzoom: 4,
      paint: { "fill-color": colors.ocean, "fill-opacity": opacity } },
    { id: "detail-rivers", type: "line", source: SOURCE, "source-layer": "water_lines", minzoom: 9,
      paint: { "line-color": colors.ocean, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 12, 1.5], "line-opacity": opacity } },
    { id: "detail-borders", type: "line", source: SOURCE, "source-layer": "boundaries",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], true]],
      paint: { "line-color": colors.border, "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.45, 8, 1], "line-opacity": opacity * 0.8 } },
    { id: "detail-province-borders", type: "line", source: SOURCE, "source-layer": "boundaries", minzoom: 7,
      filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], true]],
      paint: { "line-color": colors.border, "line-width": 0.65, "line-dasharray": [3, 2], "line-opacity": opacity * 0.7 } },
    { id: "detail-country-labels", type: "symbol", source: SOURCE, "source-layer": "boundary_labels", minzoom: 2.5, maxzoom: 7,
      filter: ["==", ["get", "admin_level"], 2], layout: { ...text, "text-size": 12, "text-letter-spacing": 0.08 }, paint: labelPaint },
    { id: "detail-province-labels", type: "symbol", source: SOURCE, "source-layer": "boundary_labels", minzoom: 4.5, maxzoom: 10,
      filter: ["==", ["get", "admin_level"], 4], layout: { ...text, "text-size": 11, "text-letter-spacing": 0.08 },
      paint: { ...labelPaint, "text-opacity": opacity * 0.6 } },
    { id: "detail-city-labels", type: "symbol", source: SOURCE, "source-layer": "place_labels", minzoom: 5,
      filter: ["in", ["get", "kind"], ["literal", ["capital", "state_capital", "city", "town"]]],
      layout: { ...text, "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 12, 13],
        "symbol-sort-key": ["-", 0, ["coalesce", ["get", "population"], 0]] }, paint: labelPaint },
  ];
}

/** Enhance the already usable local globe; remote failures reveal that same globe. */
export function attachBasemap(map: Map, root: HTMLElement, palette: () => Colors, signal: AbortSignal): () => void {
  let ready = false;
  let failed = false;
  let terrainAdded = false;
  let deadline = 0;
  let failures = 0;
  let outage = 0;
  const ids = layers(palette(), false).map(({ id }) => id);

  const updateTheme = () => {
    if (failed) return;
    const colors = palette();
    for (const layer of layers(colors, ready)) {
      if (!map.getLayer(layer.id)) continue;
      for (const [property, value] of Object.entries(layer.paint ?? {})) {
        map.setPaintProperty(layer.id, property as Parameters<Map["setPaintProperty"]>[1], value);
      }
    }
    if (map.getLayer("detail-hillshade")) {
      map.setPaintProperty("detail-hillshade", "hillshade-highlight-color", colors.terrainHighlight);
    }
  };
  const hideTerrain = () => {
    delete root.dataset.terrain;
    if (map.getLayer("detail-hillshade")) map.setLayoutProperty("detail-hillshade", "visibility", "none");
  };
  const fallback = () => {
    if (failed || signal.aborted) return;
    failed = true;
    clearTimeout(deadline);
    clearTimeout(outage);
    root.dataset.basemap = "fallback";
    for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
    hideTerrain();
  };
  const ensureTerrain = () => {
    if (!ready || failed || terrainAdded || map.getZoom() < TERRAIN_MIN_ZOOM) return;
    terrainAdded = true;
    map.addSource(ELEVATION, { type: "raster-dem", tiles: [`${HOST}/tiles/elevation-raster/{z}/{x}/{y}`],
      tileSize: 512, maxzoom: 12, encoding: "terrarium" });
    map.addLayer({ id: "detail-hillshade", type: "hillshade", source: ELEVATION, minzoom: TERRAIN_MIN_ZOOM,
      // Fade in at country scale; keep both flat land and the globe overview unshaded.
      paint: { "hillshade-method": "standard", "hillshade-shadow-color": "rgba(0, 0, 0, 0.16)",
        "hillshade-highlight-color": palette().terrainHighlight, "hillshade-accent-color": "rgba(0, 0, 0, 0.04)",
        "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], TERRAIN_MIN_ZOOM, 0, 4.75, 0.5, 6.25, 0.65, 8.25, 0.55] } }, "detail-ocean");
  };
  const onData = (event: MapEventType["sourcedata"]) => {
    if (failed || !event.tile) return;
    if (event.sourceId === ELEVATION) {
      root.dataset.terrain = "ready";
      return;
    }
    if (event.sourceId === SOURCE) {
      failures = 0;
      clearTimeout(outage);
      outage = 0;
    }
    if (!event.isSourceLoaded) return;
    if (event.sourceId === SOURCE && !ready) {
      ready = true;
      clearTimeout(deadline);
      root.dataset.basemap = "ready";
      updateTheme();
      ensureTerrain();
    }
  };
  const onError = (event: MapEventType["error"]) => {
    const source = "sourceId" in event ? event.sourceId : undefined;
    if (source === ELEVATION || event.error.message.includes("/tiles/elevation-raster/")) return;
    if (source === SOURCE || event.error.message.includes(HOST)) {
      // One missing tile should not discard the rest of a working map.
      if (++failures >= 3 && ready && !outage) outage = window.setTimeout(fallback, 8_000);
    }
  };
  map.on("sourcedata", onData);
  map.on("error", onError);
  map.on("zoom", ensureTerrain);
  signal.addEventListener("abort", () => {
    clearTimeout(deadline);
    clearTimeout(outage);
    map.off("sourcedata", onData);
    map.off("error", onError);
    map.off("zoom", ensureTerrain);
  }, { once: true });

  root.dataset.basemap = "loading";
  deadline = window.setTimeout(fallback, 12_000);
  map.addSource(SOURCE, { type: "vector", tiles: [`${HOST}/tiles/osm-vector/{z}/{x}/{y}`], maxzoom: 14 });
  for (const layer of layers(palette(), false)) map.addLayer(layer, "grid");
  return updateTheme;
}
