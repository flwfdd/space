export const ZENGALLERY_BASE_URL = "https://gallery.0u0.fun";

export type GalleryImageLevel = "low" | "mid" | "high";

export interface GalleryLocation {
  name: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
}

export interface GalleryExif {
  camera?: string;
  lens?: string;
  focalLength?: number;
  aperture?: number;
  shutterSpeed?: number;
  iso?: number;
}

export interface GalleryPhoto {
  filename: string;
  title?: string;
  description?: string;
  capturedAt?: string;
  location?: GalleryLocation;
  exif?: GalleryExif;
  tags?: string[];
  width?: number;
  height?: number;
  size?: number;
  format?: string;
}

const IMAGE_LEVELS: Record<GalleryImageLevel, { width: number; quality: number }> = {
  low: { width: 720, quality: 24 },
  mid: { width: 1080, quality: 42 },
  high: { width: 2160, quality: 84 },
};

export function getGalleryImageUrl(
  photo: GalleryPhoto,
  level: GalleryImageLevel,
): string {
  const { width, quality } = IMAGE_LEVELS[level];
  const ratio = (photo.height ?? 2) / (photo.width ?? 3);
  const height = Math.round(width * ratio);

  if (/^(?:https?:\/\/|\/)/i.test(photo.filename)) {
    return photo.filename
      .replaceAll("{width}", String(width))
      .replaceAll("{height}", String(height))
      .replaceAll("{quality}", String(quality));
  }

  const url = new URL(
    `/files/${encodeURIComponent(photo.filename)}`,
    ZENGALLERY_BASE_URL,
  );
  url.searchParams.set("level", level);
  return url.toString();
}

export function getGalleryShareUrl(photo: GalleryPhoto): string {
  if (/^(?:https?:\/\/|\/)/i.test(photo.filename)) {
    return getGalleryImageUrl(photo, "high");
  }

  return new URL(
    `/share/${encodeURIComponent(photo.filename)}`,
    ZENGALLERY_BASE_URL,
  ).toString();
}

export function getGalleryOriginalUrl(photo: GalleryPhoto): string {
  if (/^(?:https?:\/\/|\/)/i.test(photo.filename)) {
    return getGalleryImageUrl(photo, "high");
  }

  return new URL(
    `/files/${encodeURIComponent(photo.filename)}`,
    ZENGALLERY_BASE_URL,
  ).toString();
}
