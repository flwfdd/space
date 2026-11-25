import PhotoSwipeLightbox from "photoswipe/lightbox";
import type PhotoSwipe from "photoswipe";
import type { PhotoSwipeOptions } from "photoswipe";
import "photoswipe/style.css";
import "@/styles/image-viewer.css";

export const VIEWER_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const OPEN_CLOSE_EASING = "cubic-bezier(0.1, 1, 0.2, 1)";

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export async function createImageViewer(
  options: PhotoSwipeOptions,
  thumbnails: readonly HTMLElement[],
) {
  const { default: pswpModule } = await import("photoswipe");
  const lightbox = new PhotoSwipeLightbox({
    pswpModule,
    showHideAnimationType: "zoom",
    showAnimationDuration: 320,
    hideAnimationDuration: 400,
    zoomAnimationDuration: 280,
    easing: VIEWER_EASING,
    wheelToZoom: true,
    maxWidthToAnimate: 4000,
    close: true,
    zoom: false,
    imageClickAction: "zoom",
    tapAction: false,
    closeTitle: "关闭",
    arrowPrevTitle: "上一项",
    arrowNextTitle: "下一项",
    closeSVG: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    arrowPrevSVG: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    arrowNextSVG: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    ...options,
    mainClass: `image-viewer ${options.mainClass ?? ""}`.trim(),
  });
  const listeners = new AbortController();
  const hiddenThumbnails = new Set<HTMLElement>();
  let openingThumbnail: HTMLElement | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const restoreThumbnail = (thumbnail: HTMLElement | undefined) => {
    if (!thumbnail) return;
    delete thumbnail.dataset.imageViewerTransition;
    hiddenThumbnails.delete(thumbnail);
  };
  const restoreThumbnails = () => {
    for (const thumbnail of hiddenThumbnails) restoreThumbnail(thumbnail);
  };

  const setControlsVisible = (viewer: PhotoSwipe, visible: boolean) => {
    viewer.element?.classList.toggle("pswp--ui-visible", visible);
    viewer.element?.querySelectorAll<HTMLElement>("[data-viewer-idle]").forEach((element) => {
      element.inert = !visible;
    });
  };

  const resetIdle = (viewer: PhotoSwipe) => {
    if (idleTimer) clearTimeout(idleTimer);
    if (viewer.isDestroying) return;
    setControlsVisible(viewer, true);
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      if (!viewer.element?.querySelector(".pswp__hide-on-close:focus-within")) {
        setControlsVisible(viewer, false);
      }
    }, 2600);
  };

  lightbox.on("uiRegister", function (this: PhotoSwipe) {
    for (const [name, title, factor, html, order] of [
      ["zoomIn", "放大", 1.25, '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>', 10],
      ["zoomOut", "缩小", 0.8, '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>', 15],
    ] as const) {
      this.ui?.registerElement({
        name,
        order,
        isButton: true,
        title,
        html,
        onClick: () => {
          if (this.currSlide) this.zoomTo(this.currSlide.currZoomLevel * factor, undefined, this.options.zoomAnimationDuration);
        },
      });
    }
  });

  lightbox.on("afterInit", function (this: PhotoSwipe) {
    const handleIdle = () => resetIdle(this);
    for (const type of ["pointermove", "pointerdown", "click", "keydown", "focusin", "focusout"]) {
      this.element?.addEventListener(type, handleIdle, { capture: true, signal: listeners.signal });
    }
    resetIdle(this);
  });
  lightbox.on("change", function (this: PhotoSwipe) { resetIdle(this); });

  lightbox.on("openingAnimationStart", function (this: PhotoSwipe) {
    this.options.easing = OPEN_CLOSE_EASING;
    if (this.options.showHideAnimationType !== "zoom") return;
    openingThumbnail = thumbnails[this.currIndex];
    if (openingThumbnail) {
      openingThumbnail.dataset.imageViewerTransition = "opening";
      hiddenThumbnails.add(openingThumbnail);
    }
  });
  lightbox.on("openingAnimationEnd", function (this: PhotoSwipe) {
    this.options.easing = VIEWER_EASING;
    restoreThumbnail(openingThumbnail);
    openingThumbnail = undefined;
  });

  lightbox.on("closingAnimationStart", function (this: PhotoSwipe) {
    this.options.easing = OPEN_CLOSE_EASING;
    if (idleTimer) clearTimeout(idleTimer);
    const thumbnail = thumbnails[this.currIndex];
    if (!thumbnail || this.options.showHideAnimationType !== "zoom" || !this.getThumbBounds()) return;
    const rect = thumbnail.getBoundingClientRect();
    const slide = this.currSlide;
    if (!prefersReducedMotion() && Number(this.options.hideAnimationDuration) > 0
      && slide && slide.currZoomLevel * slide.width < this.options.maxWidthToAnimate
      && !this.mainScroll.isShifted() && rect.bottom > 0 && rect.top < window.innerHeight) {
      thumbnail.dataset.imageViewerTransition = "closing";
      hiddenThumbnails.add(thumbnail);
    }
  });
  lightbox.on("destroy", () => {
    if (idleTimer) clearTimeout(idleTimer);
    listeners.abort();
    restoreThumbnails();
  });
  // PhotoSwipe restores focus on destroy; its target must be visible before that event.
  lightbox.on("closingAnimationEnd", restoreThumbnails);

  return { lightbox, resetIdle };
}
