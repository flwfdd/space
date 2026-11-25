import type PhotoSwipe from "photoswipe";
import type { SlideData } from "photoswipe";

import { createImageViewer, prefersReducedMotion, VIEWER_EASING } from "@/lib/image-viewer";
import { getGalleryImageUrl, getGalleryOriginalUrl, type GalleryPhoto } from "@/lib/gallery";
import { formatFileSize, renderCaption, renderInfo, type GalleryOriginalControls } from "@/lib/gallery-info";

const INFO_GAP = 24;
const DESKTOP_QUERY = "(min-width: 800px) and (orientation: landscape)";
const INFO_ICON = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v5M12 7.5h.01"/></svg>';

function fadeOut(element: HTMLElement, duration: number): void {
  const { opacity, transform } = getComputedStyle(element);
  element.getAnimations().forEach((animation) => animation.cancel());
  element.animate(
    [{ opacity, transform }, { opacity: 0, transform }],
    { duration, easing: "ease-out", fill: "forwards" },
  );
}

function createSlides(
  photos: readonly GalleryPhoto[],
  triggers: readonly HTMLElement[],
): SlideData[] {
  return photos.map((photo, index) => {
    const image = triggers[index]?.querySelector("img");
    const naturalWidth = image instanceof HTMLImageElement ? image.naturalWidth : 0;
    const naturalHeight = image instanceof HTMLImageElement ? image.naturalHeight : 0;
    const width = photo.width ?? (naturalWidth || 1600);
    const height = photo.height ?? (naturalHeight || Math.round(width * 2 / 3));

    return {
      element: triggers[index] ?? image,
      src: getGalleryImageUrl(photo, "high"),
      msrc: image instanceof HTMLImageElement && image.currentSrc
        ? image.currentSrc : getGalleryImageUrl(photo, "mid"),
      width,
      height,
      alt: photo.title ?? "Gallery photo",
    };
  });
}

export async function openGalleryLightbox(
  photos: readonly GalleryPhoto[],
  index: number,
  trigger: HTMLElement,
): Promise<void> {
  if (!Number.isInteger(index) || !photos[index]) return;
  const root = trigger.closest<HTMLElement>("[data-gallery]") ?? document;
  const triggers = Array.from(root.querySelectorAll<HTMLElement>("[data-gallery-trigger]"));
  const slides = createSlides(photos, triggers);
  const desktopLayout = window.matchMedia(DESKTOP_QUERY);
  const listeners = new AbortController();
  let infoVisible = desktopLayout.matches;
  let presentedIndex: number | undefined;
  let panel: HTMLElement | undefined;
  let panelContent: HTMLElement | undefined;
  let backdrops: HTMLDivElement[] = [];
  let activeBackdrop = 0;
  let caption: HTMLElement | undefined;
  let infoButton: HTMLElement | undefined;
  let panelAnimation: Animation | undefined;
  let imageAnimation: Animation | undefined;
  let dragStartY = 0;
  let dragDistance = 0;
  let dragPointerId: number | undefined;
  let suppressHandleClick = false;
  let stage: HTMLElement | undefined;
  const { lightbox, resetIdle } = await createImageViewer({
    mainClass: "gallery-pswp",
    dataSource: slides,
    thumbSelector: ".gallery-item-media",
    bgOpacity: 1,
    paddingFn: () => {
      const desktop = desktopLayout.matches;
      const infoWidth = panel?.getBoundingClientRect().width
        ?? 22 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      return {
        top: desktop ? 24 : 64,
        right: desktop && infoVisible ? infoWidth + INFO_GAP : desktop ? 24 : 16,
        bottom: desktop ? 32 : 24,
        left: desktop ? 24 : 16,
      };
    },
    preload: [1, 1],
    counter: false,
    arrowPrev: slides.length > 1,
    arrowNext: slides.length > 1,
    arrowPrevTitle: "上一张",
    arrowNextTitle: "下一张",
  }, triggers.map((trigger) => trigger.closest<HTMLElement>(".gallery-card") ?? trigger));

  let originalController: AbortController | undefined;
  const originals = new Map<number, string>();

  const cancelOriginal = () => {
    originalController?.abort();
    originalController = undefined;
  };

  const loadOriginal = async (
    viewer: PhotoSwipe,
    photo: GalleryPhoto,
    { button, label, progress, status }: GalleryOriginalControls,
  ) => {
    if (button.getAttribute("aria-disabled") === "true") return;
    cancelOriginal();
    const controller = new AbortController();
    originalController = controller;
    const slideIndex = viewer.currIndex;
    let objectUrl: string | undefined;
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("aria-busy", "true");
    progress.hidden = false;
    progress.value = 0;
    status.textContent = "准备下载";

    try {
      const response = await fetch(getGalleryOriginalUrl(photo), { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const total = Number(response.headers.get("content-length")) || 0;
      if (total > 0) progress.max = total;
      else progress.removeAttribute("value");

      const chunks: BlobPart[] = [];
      let loaded = 0;

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value.slice().buffer);
          loaded += value.byteLength;

          if (total > 0) {
            progress.value = loaded;
            status.textContent = `下载中 ${Math.min(100, Math.round(loaded / total * 100))}%`;
          } else {
            status.textContent = `已下载 ${formatFileSize(loaded)}`;
          }
        }
      } else {
        chunks.push(new Uint8Array(await response.arrayBuffer()));
      }

      if (controller.signal.aborted) return;

      const blob = new Blob(chunks, {
        type: response.headers.get("content-type") || "image/jpeg",
      });
      objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      if (controller.signal.aborted || viewer.isDestroying || viewer.currIndex !== slideIndex) return;

      // Keep original URLs valid for cached slides until this viewer is destroyed.
      originals.set(slideIndex, objectUrl);
      slides[slideIndex] = {
        ...slides[slideIndex],
        src: objectUrl,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
      objectUrl = undefined;
      const previousSlide = viewer.currSlide;
      const previousZoom = previousSlide && previousSlide.currZoomLevel * previousSlide.width / image.naturalWidth;
      const previousPan = previousSlide && { ...previousSlide.pan };
      viewer.refreshSlideContent(slideIndex);
      if (previousZoom && previousPan && viewer.currSlide) {
        viewer.currSlide.zoomTo(previousZoom, undefined, 0, true);
        viewer.currSlide.panTo(previousPan.x, previousPan.y);
      }
      label.textContent = "已加载原图";
      status.textContent = "";
    } catch {
      if (controller.signal.aborted) return;
      status.textContent = "加载失败，点击重试";
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (originalController === controller) originalController = undefined;
      progress.hidden = true;
      button.removeAttribute("aria-busy");
      if (!originals.has(slideIndex)) button.removeAttribute("aria-disabled");
    }
  };

  const updatePresentation = (photo: GalleryPhoto) => {
    const nextIndex = activeBackdrop === 0 ? 1 : 0;
    const next = backdrops[nextIndex];
    const current = backdrops[activeBackdrop];

    if (next && current) {
      const currentOpacity = getComputedStyle(current).opacity;
      next.style.backgroundImage = `url(${JSON.stringify(getGalleryImageUrl(photo, "mid"))})`;
      next.style.zIndex = "1";
      current.style.zIndex = "0";
      for (const backdrop of backdrops) {
        backdrop.getAnimations().forEach((animation) => animation.cancel());
      }
      next.animate(
        [{ opacity: 0 }, { opacity: 0.42 }],
        { duration: prefersReducedMotion() ? 0 : 360, easing: "ease-out", fill: "forwards" },
      );
      current.animate(
        [{ opacity: currentOpacity }, { opacity: 0 }],
        { duration: prefersReducedMotion() ? 0 : 360, easing: "ease-out", fill: "forwards" },
      );
      activeBackdrop = nextIndex;
    }

    if (caption) renderCaption(caption, photo);
  };

  const updateCurrentPhoto = (viewer: PhotoSwipe) => {
    const photo = photos[viewer.currIndex];
    // refreshSlideContent also emits change; retain the panel and focus when only the image changes.
    if (!photo || !panelContent || presentedIndex === viewer.currIndex) return;
    presentedIndex = viewer.currIndex;
    cancelOriginal();
    updatePresentation(photo);
    renderInfo(panelContent, photo, (photo, controls) => loadOriginal(viewer, photo, controls), originals.has(viewer.currIndex));
  };

  lightbox.on("close", function (this: PhotoSwipe) {
    cancelOriginal();
    const slide = this.currSlide;
    const imageFrame = imageAnimation?.playState === "running"
      ? slide?.content.element?.getBoundingClientRect() : undefined;
    imageAnimation?.cancel();
    // Freeze the stage during close; thumb bounds below account for its mobile transform.
    if (stage) {
      const { scale, translate } = getComputedStyle(stage);
      stage.style.transition = "none";
      stage.style.scale = scale;
      stage.style.translate = translate;
      if (imageFrame && slide) {
        const stageRect = stage.getBoundingClientRect();
        const stageScale = stageRect.width / stage.offsetWidth;
        slide.setZoomLevel(imageFrame.width / stageScale / slide.width);
        slide.pan.x = (imageFrame.x - stageRect.x) / stageScale;
        slide.pan.y = (imageFrame.y - stageRect.y) / stageScale;
        slide.applyCurrentZoomPan();
      }
    }
  });

  lightbox.addFilter("thumbBounds", (bounds, _data, slideIndex) => {
    const thumbnail = triggers[slideIndex]?.querySelector(".gallery-item-media") ?? trigger;
    const thumbnailRect = thumbnail.getBoundingClientRect();
    const originalBounds = bounds ?? { x: thumbnailRect.x, y: thumbnailRect.y, w: thumbnailRect.width };
    const viewer = lightbox.pswp;
    if (!viewer?.isDestroying || !stage) return originalBounds;
    const card = triggers[slideIndex]?.closest<HTMLElement>(".gallery-card");
    const media = card?.querySelector<HTMLElement>(".gallery-item-media");
    if (!card || !media) return originalBounds;
    const rect = media.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const stageScale = stageRect.width / stage.offsetWidth;
    return {
      x: (rect.x - stageRect.x) / stageScale,
      y: (rect.y - stageRect.y) / stageScale,
      w: rect.width / stageScale,
    };
  });

  lightbox.on("closingAnimationStart", function (this: PhotoSwipe) {
    const duration = prefersReducedMotion() ? 0 : Number(this.options.hideAnimationDuration);
    for (const backdrop of backdrops) fadeOut(backdrop, duration);
    if (panel && !panel.hidden) {
      panel.inert = true;
      panel.setAttribute("aria-hidden", "true");
      fadeOut(panel, duration);
    }
  });

  const setInfoVisibility = (visible: boolean, viewer: PhotoSwipe, animate = true) => {
    if (!panel || viewer.isDestroying) return;
    const shouldAnimate = animate && infoVisible !== visible;
    const mobile = !desktopLayout.matches;
    const hiddenTransform = mobile ? "translateY(100%)" : "translateX(100%)";
    const previousStyle = getComputedStyle(panel);
    const fromTransform = panel.hidden ? hiddenTransform : previousStyle.transform;
    const fromOpacity = panel.hidden ? "0" : previousStyle.opacity;
    const image = viewer.currSlide?.content.element;
    const previousFrame = image?.getBoundingClientRect();

    panelAnimation?.cancel();
    imageAnimation?.cancel();
    dragPointerId = undefined;
    infoVisible = visible;
    resetIdle(viewer);

    if (!visible && panel.contains(document.activeElement)) infoButton?.focus({ preventScroll: true });
    panel.hidden = false;
    panel.inert = !visible;
    panel.setAttribute("aria-hidden", String(!visible));
    panel.style.transform = visible ? "none" : hiddenTransform;
    panel.style.opacity = visible ? "1" : "0";
    infoButton?.setAttribute("aria-expanded", String(visible));
    viewer.element?.classList.toggle("gallery-info-open", visible);
    if (viewer.isOpen) viewer.updateSize(true);

    if (!shouldAnimate || prefersReducedMotion()) {
      panel.hidden = !visible;
      return;
    }

    if (!mobile && image && previousFrame) {
      const nextFrame = image.getBoundingClientRect();
      if (previousFrame.width > 0 && nextFrame.width > 0 && image.offsetWidth > 0) {
        // The image is inside PhotoSwipe's zoom transform: convert viewport pixels to local pixels.
        const parentScale = nextFrame.width / image.offsetWidth;
        const x = (previousFrame.x - nextFrame.x) / parentScale;
        const y = (previousFrame.y - nextFrame.y) / parentScale;
        image.style.transformOrigin = "0 0";
        imageAnimation = image.animate([
          { transform: `translate(${x}px, ${y}px) scale(${previousFrame.width / nextFrame.width}, ${previousFrame.height / nextFrame.height})` },
          { transform: "none" },
        ], { duration: 280, easing: VIEWER_EASING });
      }
    }

    panelAnimation = panel.animate([
      { transform: fromTransform, opacity: fromOpacity },
      { transform: visible ? "none" : hiddenTransform, opacity: visible ? 1 : 0 },
    ], { duration: 280, easing: VIEWER_EASING });
    panelAnimation.addEventListener("finish", () => {
      if (panel) panel.hidden = !infoVisible;
    });
  };

  lightbox.on("uiRegister", function (this: PhotoSwipe) {
    this.ui?.registerElement({
      name: "galleryInfo",
      order: 20,
      isButton: true,
      title: "照片信息",
      ariaLabel: "照片信息",
      html: INFO_ICON,
      onInit: (element) => {
        infoButton = element;
        element.setAttribute("aria-controls", "gallery-viewer-info");
      },
      onClick: () => setInfoVisibility(!infoVisible, this),
    });

    this.on("change", () => updateCurrentPhoto(this));
    this.on("afterInit", () => {
      const scrollElement = this.scrollWrap;
      if (!this.element || !scrollElement) return;

      stage = document.createElement("div");
      stage.className = "gallery-viewer-stage";
      scrollElement.before(stage);
      stage.append(scrollElement);
      for (const arrow of this.element.querySelectorAll<HTMLElement>(":scope > .pswp__button--arrow")) {
        stage.append(arrow);
      }

      backdrops = [0, 1].map(() => {
        const layer = document.createElement("div");
        layer.className = "gallery-viewer-backdrop";
        layer.setAttribute("aria-hidden", "true");
        return layer;
      });
      stage.before(...backdrops);

      caption = document.createElement("div");
      caption.className = "gallery-viewer-caption pswp__hide-on-close";
      caption.dataset.viewerIdle = "";
      stage.append(caption);

      panel = document.createElement("aside");
      panel.id = "gallery-viewer-info";
      panel.className = "gallery-viewer-info";
      panel.setAttribute("aria-label", "照片信息");

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "gallery-viewer-grab";
      handle.setAttribute("aria-label", "下拉关闭信息面板");

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "gallery-viewer-close";
      closeButton.setAttribute("aria-label", "关闭信息面板");
      closeButton.textContent = "×";
      closeButton.addEventListener("click", () => setInfoVisibility(false, this));

      const scroll = document.createElement("div");
      scroll.className = "gallery-viewer-scroll";

      panelContent = document.createElement("div");
      panelContent.className = "gallery-viewer-content";
      scroll.append(panelContent);
      panel.append(handle, closeButton, scroll);
      panel.addEventListener("click", (event) => event.stopPropagation());
      panel.addEventListener("pointerdown", (event) => event.stopPropagation());
      panel.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
      this.element.append(panel);
      setInfoVisibility(infoVisible, this, false);
      desktopLayout.addEventListener("change", () => setInfoVisibility(infoVisible, this, false), { signal: listeners.signal });
      updateCurrentPhoto(this);

      const finishDrag = (event: PointerEvent) => {
        if (dragPointerId !== event.pointerId || !panel) return;
        const distance = dragDistance;
        dragPointerId = undefined;
        dragStartY = 0;
        dragDistance = 0;
        if (distance > 100 && event.type === "pointerup") {
          setInfoVisibility(false, this);
        } else if (distance > 0 && !prefersReducedMotion()) {
          panel.style.transform = "none";
          panelAnimation = panel.animate(
            [{ transform: `translateY(${distance}px)` }, { transform: "translateY(0)" }],
            { duration: 180, easing: VIEWER_EASING },
          );
        } else {
          panel.style.transform = "none";
        }
      };

      handle.addEventListener("pointerdown", (event) => {
        if (desktopLayout.matches || !event.isPrimary || event.button !== 0 || dragPointerId !== undefined) return;
        event.preventDefault();
        const offset = new DOMMatrixReadOnly(getComputedStyle(panel!).transform).m42;
        panelAnimation?.cancel();
        dragPointerId = event.pointerId;
        dragStartY = event.clientY - offset;
        dragDistance = offset;
        panel!.style.transform = `translateY(${offset}px)`;
        panel!.style.opacity = "1";
        suppressHandleClick = false;
        handle.setPointerCapture(event.pointerId);
      });

      handle.addEventListener("pointermove", (event) => {
        if (dragPointerId !== event.pointerId) return;
        dragDistance = Math.max(0, event.clientY - dragStartY);
        if (dragDistance > 4) suppressHandleClick = true;
        if (panel) panel.style.transform = `translateY(${dragDistance}px)`;
      });

      handle.addEventListener("pointerup", finishDrag);
      handle.addEventListener("pointercancel", finishDrag);
      handle.addEventListener("lostpointercapture", finishDrag);
      handle.addEventListener("click", () => {
        if (suppressHandleClick) {
          suppressHandleClick = false;
          return;
        }
        setInfoVisibility(false, this);
      });
    });
  });

  lightbox.on("destroy", () => {
    listeners.abort();
    cancelOriginal();
    for (const url of originals.values()) URL.revokeObjectURL(url);
    originals.clear();
    panelAnimation?.cancel();
    imageAnimation?.cancel();
  });

  lightbox.init();
  if (!lightbox.loadAndOpen(index)) lightbox.destroy();
}
