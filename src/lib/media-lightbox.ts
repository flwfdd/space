import PhotoSwipeLightbox from "photoswipe/lightbox";
import type PhotoSwipe from "photoswipe";
import type { SlideData } from "photoswipe";
import "photoswipe/style.css";

type MediaEntry = {
  trigger: HTMLElement;
  item: SlideData;
  objectUrl?: string;
};

const SVG_STYLE_PROPERTIES = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linejoin",
  "stroke-dasharray",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "filter",
  "opacity",
];

function imageItem(image: HTMLImageElement): SlideData {
  return {
    element: image,
    src: image.currentSrc || image.src,
    msrc: image.currentSrc || image.src,
    srcset: image.srcset || undefined,
    sizes: image.sizes || undefined,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    alt: image.alt,
  };
}

function mermaidItem(pre: HTMLElement): SlideData | undefined {
  const svg = pre.querySelector<SVGSVGElement>("svg");
  if (!svg) return;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("style");

  const sourceNodes = [svg, ...svg.querySelectorAll<SVGElement>("*")];
  const cloneNodes = [clone, ...clone.querySelectorAll<SVGElement>("*")];
  sourceNodes.forEach((source, index) => {
    const target = cloneNodes[index];
    if (!target) return;
    const computed = getComputedStyle(source);
    for (const property of SVG_STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (value) target.style.setProperty(property, value);
    }
  });

  const viewBox = svg.viewBox.baseVal;
  const bounds = svg.getBoundingClientRect();
  const width = viewBox.width || bounds.width;
  const height = viewBox.height || bounds.height;
  if (width && height) {
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
  }
  clone.style.backgroundColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-surface-raised")
    .trim();

  const objectUrl = URL.createObjectURL(new Blob(
    [new XMLSerializer().serializeToString(clone)],
    { type: "image/svg+xml;charset=utf-8" },
  ));
  return {
    element: pre,
    src: objectUrl,
    msrc: objectUrl,
    width,
    height,
    alt: "Mermaid 图表",
  };
}

function collectMediaItems(trigger: HTMLElement): MediaEntry[] {
  const root = trigger.closest(".prose");
  if (!root) return [];

  const entries: MediaEntry[] = [];
  root.querySelectorAll<HTMLElement>("img, pre.mermaid").forEach((element) => {
    if (element instanceof HTMLImageElement) {
      if (element.closest("a")) return;
      entries.push({ trigger: element, item: imageItem(element) });
      return;
    }
    const item = mermaidItem(element);
    if (item) {
      entries.push({ trigger: element, item, objectUrl: item.src });
    }
  });
  return entries;
}

function revokeMediaUrls(entries: MediaEntry[]) {
  for (const entry of entries) {
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
  }
}

export function openMediaLightbox(trigger: HTMLElement) {
  const entries = collectMediaItems(trigger);
  const index = entries.findIndex((entry) => entry.trigger === trigger);
  if (index < 0) {
    revokeMediaUrls(entries);
    return;
  }

  const lightbox = new PhotoSwipeLightbox({
    dataSource: entries.map((entry) => entry.item),
    pswpModule: () => import("photoswipe"),
    showHideAnimationType: trigger.matches("pre.mermaid") ? "fade" : "zoom",
    zoomAnimationDuration: 220,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    bgOpacity: 0.35,
    wheelToZoom: true,
    padding: { top: 48, right: 24, bottom: 24, left: 24 },
    counter: entries.length > 1,
    arrowPrev: entries.length > 1,
    arrowNext: entries.length > 1,
    close: true,
    zoom: false,
    closeTitle: "关闭",
    arrowPrevTitle: "上一项",
    arrowNextTitle: "下一项",
    closeSVG: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    arrowPrevSVG: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    arrowNextSVG: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  });

  lightbox.on("uiRegister", function (this: PhotoSwipe) {
    const zoomByFactor = (factor: number) => {
      const slide = this.currSlide;
      if (slide) this.zoomTo(slide.currZoomLevel * factor);
    };

    this.ui?.registerElement({
      name: "zoomIn",
      order: 10,
      isButton: true,
      title: "放大",
      html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
      onClick: () => zoomByFactor(1.25),
    });
    this.ui?.registerElement({
      name: "zoomOut",
      order: 15,
      isButton: true,
      title: "缩小",
      html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
      onClick: () => zoomByFactor(0.8),
    });
  });
  lightbox.on("openingAnimationStart", () => {
    document.body.classList.remove("media-preview-closing");
  });
  lightbox.on("closingAnimationStart", () => {
    document.body.classList.add("media-preview-closing");
  });
  lightbox.on("destroy", () => {
    document.body.classList.remove("media-preview-closing");
    revokeMediaUrls(entries);
  });
  lightbox.init();
  if (!lightbox.loadAndOpen(index)) {
    document.body.classList.remove("media-preview-closing");
    lightbox.destroy();
    revokeMediaUrls(entries);
  }
}
