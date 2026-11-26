import type { Map as GlobeMap, MapMovementEvent } from "maplibre-gl";

const IDLE_DELAY = 8_000;
const DEGREES_PER_SECOND = 3;
const RETURN_SECONDS = 6;

interface HomeView { latitude: number; zoom: number; bearing: number }
interface RotationOptions {
  signal: AbortSignal;
  home: () => HomeView;
  canRotate: () => boolean;
  onResume: () => void;
}

/** Ease back to the overview while gradually resuming rotation. */
export function attachGlobeRotation(map: GlobeMap, { signal, home, canRotate, onResume }: RotationOptions): void {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const pointers = new Set<number>();
  let frame = 0;
  let timer = 0;
  let lastTime = 0;
  let returning: { from: HomeView & { pitch: number }; to: HomeView; elapsed: number } | undefined;
  let pageActive = true;
  let contextLost = false;

  const allowed = () => !signal.aborted && pageActive && !document.hidden && !reducedMotion.matches
    && !contextLost && pointers.size === 0 && canRotate();

  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = timer = lastTime = 0;
    returning = undefined;
  };

  const rotate = (now: number) => {
    if (!allowed() || map.isMoving()) { stop(); return; }
    const elapsed = lastTime ? Math.min(now - lastTime, 50) / 1000 : 0;
    lastTime = now;
    if (!returning) {
      returning = { from: { latitude: map.getCenter().lat, zoom: map.getZoom(),
        bearing: map.getBearing(), pitch: map.getPitch() }, to: home(), elapsed: 0 };
      onResume();
    }
    returning.elapsed += elapsed;
    const { from, to } = returning;
    const t = Math.min(1, returning.elapsed / RETURN_SECONDS);
    // Zero velocity and acceleration at both ends, with a gradual middle section.
    const progress = t * t * t * (t * (t * 6 - 15) + 10);
    const zoom = from.zoom + (to.zoom - from.zoom) * progress;
    // Keep rotation gentle in screen space while the camera pulls out from details.
    const speed = DEGREES_PER_SECOND * progress / 2 ** Math.max(0, zoom - to.zoom);
    if (elapsed) {
      const center = map.getCenter();
      center.lng -= speed * elapsed;
      center.lat = from.latitude + (to.latitude - from.latitude) * progress;
      const bearingDelta = (to.bearing - from.bearing + 540) % 360 - 180;
      map.jumpTo({ center: center.wrap(), zoom, bearing: from.bearing + bearingDelta * progress,
        pitch: from.pitch * (1 - progress) }, { idleRotation: true });
    }
    frame = requestAnimationFrame(rotate);
  };

  const resume = (delay = IDLE_DELAY) => {
    stop();
    if (allowed()) timer = window.setTimeout(() => { frame = requestAnimationFrame(rotate); }, delay);
  };
  const activity = () => resume();
  const onMoveStart = (event: MapMovementEvent) => {
    if (!("idleRotation" in event && event.idleRotation)) stop();
  };
  const onMoveEnd = (event: MapMovementEvent) => {
    if (!("idleRotation" in event && event.idleRotation)) resume();
  };
  const onContextLost = () => { contextLost = true; stop(); };
  const onContextRestored = () => { contextLost = false; resume(); };

  const inputOptions = { signal, capture: true, passive: true };
  document.addEventListener("pointerdown", (event) => { pointers.add(event.pointerId); stop(); }, inputOptions);
  for (const type of ["pointerup", "pointercancel"] as const) {
    document.addEventListener(type, (event) => { pointers.delete(event.pointerId); resume(); }, inputOptions);
  }
  for (const type of ["wheel", "keydown", "click"] as const) {
    document.addEventListener(type, activity, inputOptions);
  }
  document.addEventListener("visibilitychange", () => { pointers.clear(); resume(); }, { signal });
  reducedMotion.addEventListener("change", activity, { signal });
  addEventListener("pagehide", () => { pageActive = false; pointers.clear(); stop(); }, { signal });
  addEventListener("pageshow", () => { pageActive = true; resume(); }, { signal });
  addEventListener("blur", () => { pointers.clear(); resume(); }, { signal });
  map.on("movestart", onMoveStart);
  map.on("moveend", onMoveEnd);
  map.on("webglcontextlost", onContextLost);
  map.on("webglcontextrestored", onContextRestored);
  signal.addEventListener("abort", () => {
    stop();
    map.off("movestart", onMoveStart);
    map.off("moveend", onMoveEnd);
    map.off("webglcontextlost", onContextLost);
    map.off("webglcontextrestored", onContextRestored);
  }, { once: true });
  resume(1_500);
}
