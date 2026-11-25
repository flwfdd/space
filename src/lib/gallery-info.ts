import { formatDate, formatUtcOffset } from "@/lib/date";
import { getGalleryShareUrl, type GalleryPhoto } from "@/lib/gallery";
import { isExternalHref, parseInlineMarkdown } from "@/lib/inline-markdown";

export interface GalleryOriginalControls {
  button: HTMLButtonElement;
  label: HTMLSpanElement;
  progress: HTMLProgressElement;
  status: HTMLSpanElement;
}

function appendInlineMarkdown(container: HTMLElement, value: string): void {
  for (const part of parseInlineMarkdown(value)) {
    if (part.type === "text") {
      container.append(document.createTextNode(part.value));
      continue;
    }

    const link = document.createElement("a");
    link.href = part.href;
    link.textContent = part.label;
    if (isExternalHref(part.href)) {
      link.target = "_blank";
      link.rel = "noreferrer";
    }
    container.append(link);
  }
}

function formatShutterSpeed(seconds: number): string {
  if (seconds < 1) return `1/${Math.round(1 / seconds)}s`;
  return `${seconds}s`;
}

type GalleryMetaIcon =
  | "location"
  | "coordinates"
  | "altitude"
  | "calendar"
  | "timezone"
  | "camera"
  | "lens"
  | "focalLength"
  | "aperture"
  | "shutter"
  | "iso"
  | "dimensions"
  | "format"
  | "fileSize"
  | "download"
  | "link";

const META_ICON_PATHS: Record<GalleryMetaIcon, string> = {
  location: "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0ZM14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0Z",
  coordinates: "M12 2v3M12 19v3M2 12h3M19 12h3M18 12a6 6 0 1 1-12 0 6 6 0 1 1 12 0Z",
  altitude: "M3 20l6-10 4 6 3-5 5 9H3ZM7 10l2-4 2 4",
  calendar: "M6 2v4M18 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  timezone: "M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 1 1 17 0ZM3.5 12h17M12 3.5c2.5 2.3 2.5 14.7 0 17M12 3.5c-2.5 2.3-2.5 14.7 0 17",
  dimensions: "M3 7h18v10H3zM7 7v3M11 7v5M15 7v3M19 7v5",
  format: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M8 17l2-2 2 2 3-3 2 4",
  fileSize: "M20 6c0 1.7-3.6 3-8 3S4 7.7 4 6s3.6-3 8-3 8 1.3 8 3ZM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M5 20h14",
  link: "M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1",
  camera: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3ZM15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 1 1 7 0Z",
  lens: "M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 1 1 17 0ZM15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 1 1 7 0ZM4 12h4M16 12h4",
  focalLength: "M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0Z",
  aperture: "M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 1 1 17 0ZM12 3.5l2 5M20.5 12h-5M16.5 20.5l-2-5M12 20.5l-2-5M3.5 12h5M7.5 3.5l2 5",
  shutter: "M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 1 1 17 0ZM12 7v5l3 2",
  iso: "M4 14a8 8 0 1 1 16 0M12 14l4-4M6 18h12",
};

function createMetaIcon(icon: GalleryMetaIcon): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", META_ICON_PATHS[icon]);
  svg.append(path);
  return svg;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function appendMetaRow(container: HTMLElement, label: string, value: string, icon: GalleryMetaIcon): void {
  const row = document.createElement("div");
  row.className = "gallery-viewer-row";

  const term = document.createElement("dt");
  const termLabel = document.createElement("span");
  termLabel.className = "gallery-viewer-row-label";
  termLabel.textContent = label;

  const iconSlot = document.createElement("span");
  iconSlot.className = "gallery-viewer-row-icon";
  iconSlot.setAttribute("aria-hidden", "true");
  iconSlot.append(createMetaIcon(icon));
  term.append(termLabel, iconSlot);

  const detail = document.createElement("dd");
  detail.textContent = value;

  row.append(term, detail);
  container.append(row);
}

function appendTags(container: HTMLElement, tags: readonly string[] | undefined, className: string): void {
  if (!tags?.length) return;
  const list = document.createElement("div");
  list.className = className;
  for (const tag of tags) {
    const item = document.createElement("span");
    item.textContent = tag;
    list.append(item);
  }
  container.append(list);
}

export function renderInfo(
  panel: HTMLElement,
  photo: GalleryPhoto,
  onLoadOriginal: (photo: GalleryPhoto, controls: GalleryOriginalControls) => void,
  originalLoaded = false,
): void {
  panel.replaceChildren();

  const header = document.createElement("div");
  header.className = "gallery-viewer-header";

  const title = document.createElement("h2");
  title.className = "gallery-viewer-title";
  title.textContent = photo.title ?? "Untitled";

  header.append(title);
  panel.append(header);

  if (photo.description) {
    const description = document.createElement("p");
    description.className = "gallery-viewer-description";
    appendInlineMarkdown(description, photo.description);
    panel.append(description);
  }

  const details = document.createElement("dl");
  details.className = "gallery-viewer-details";

  if (photo.location) {
    appendMetaRow(details, "地点", photo.location.name, "location");
    if (photo.location.latitude != null && photo.location.longitude != null) {
      appendMetaRow(
        details,
        "经纬度",
        `${photo.location.latitude.toFixed(5)}, ${photo.location.longitude.toFixed(5)}`,
        "coordinates",
      );
    }
    if (photo.location.altitude != null) {
      appendMetaRow(details, "海拔", `${photo.location.altitude}m`, "altitude");
    }
  }

  if (photo.capturedAt) {
    try {
      appendMetaRow(details, "拍摄时间", formatDate(photo.capturedAt, { format: "datetime" }), "calendar");
      appendMetaRow(details, "时区", formatUtcOffset(photo.capturedAt), "timezone");
    } catch {
      appendMetaRow(details, "拍摄时间", photo.capturedAt, "calendar");
    }
  }

  const exif = photo.exif;
  if (exif?.camera) appendMetaRow(details, "相机", exif.camera, "camera");
  if (exif?.lens) appendMetaRow(details, "镜头", exif.lens, "lens");
  if (exif?.focalLength != null) appendMetaRow(details, "焦距", `${exif.focalLength}mm`, "focalLength");
  if (exif?.aperture != null) appendMetaRow(details, "光圈", `f/${exif.aperture}`, "aperture");
  if (exif?.shutterSpeed != null) appendMetaRow(details, "快门", formatShutterSpeed(exif.shutterSpeed), "shutter");
  if (exif?.iso != null) appendMetaRow(details, "感光度", `ISO ${exif.iso}`, "iso");

  if (photo.width && photo.height) {
    appendMetaRow(details, "尺寸", `${photo.width} × ${photo.height}`, "dimensions");
  }
  if (photo.format) appendMetaRow(details, "格式", photo.format, "format");
  if (photo.size != null) appendMetaRow(details, "文件大小", formatFileSize(photo.size), "fileSize");

  if (details.childElementCount > 0) panel.append(details);

  appendTags(panel, photo.tags, "gallery-viewer-tags");

  const actions = document.createElement("div");
  actions.className = "gallery-viewer-actions";

  const original = document.createElement("div");
  original.className = "gallery-original";

  const originalButton = document.createElement("button");
  originalButton.type = "button";
  originalButton.className = "gallery-viewer-action gallery-original-button";

  const originalLabel = document.createElement("span");
  originalLabel.className = "gallery-action-label";
  originalLabel.textContent = originalLoaded ? "已加载原图" : "加载原图";
  if (originalLoaded) originalButton.setAttribute("aria-disabled", "true");

  const progress = document.createElement("progress");
  progress.setAttribute("aria-label", "原图下载进度");
  progress.max = 100;
  progress.value = 0;
  progress.hidden = true;

  const status = document.createElement("span");
  status.className = "gallery-original-status";
  status.setAttribute("role", "status");

  originalButton.append(createMetaIcon("download"), originalLabel, status);
  originalButton.addEventListener("click", () => onLoadOriginal(photo, {
    button: originalButton,
    label: originalLabel,
    progress,
    status,
  }));
  original.append(originalButton, progress);

  const source = document.createElement("a");
  source.className = "gallery-viewer-action gallery-viewer-source";
  source.href = getGalleryShareUrl(photo);
  source.target = "_blank";
  source.rel = "noreferrer";

  const sourceLabel = document.createElement("span");
  sourceLabel.className = "gallery-action-label";
  sourceLabel.textContent = /^(?:https?:\/\/|\/)/i.test(photo.filename)
    ? "查看图片来源" : "在 ZenGallery 中查看";

  source.append(createMetaIcon("link"), sourceLabel);
  actions.append(original, source);
  panel.append(actions);
}

export function renderCaption(caption: HTMLElement, photo: GalleryPhoto): void {
  caption.replaceChildren();

  const title = document.createElement("h2");
  title.textContent = photo.title ?? "Untitled";
  caption.append(title);

  if (photo.description) {
    const description = document.createElement("p");
    appendInlineMarkdown(description, photo.description);
    caption.append(description);
  }

  if (photo.location || (photo.tags && photo.tags.length > 0)) {
    const meta = document.createElement("div");
    meta.className = "gallery-viewer-caption-meta";

    if (photo.location) {
      const location = document.createElement("p");
      const locationLabel = document.createElement("span");
      locationLabel.textContent = photo.location.name;
      location.append(createMetaIcon("location"), locationLabel);
      meta.append(location);
    }

    appendTags(meta, photo.tags, "gallery-viewer-caption-tags");

    caption.append(meta);
  }
}
