import { galleryPhotos } from "@/data/gallery";
import { launchImageViewer } from "@/lib/image-viewer-launch";

export function initGallery(): void {
  document.querySelectorAll<HTMLAnchorElement>("[data-gallery-trigger]").forEach((trigger) => {
    if (trigger.dataset.galleryBound) return;
    trigger.dataset.galleryBound = "true";

    trigger.addEventListener("click", async (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const index = Number(trigger.dataset.galleryIndex);
      if (!Number.isInteger(index) || index < 0 || index >= galleryPhotos.length) return;

      event.preventDefault();
      try {
        await launchImageViewer(trigger, async () => {
          const { openGalleryLightbox } = await import("@/lib/gallery-lightbox");
          await openGalleryLightbox(galleryPhotos, index, trigger);
        });
      } catch (error) {
        console.error("Gallery 预览加载失败", error);
        window.location.assign(trigger.href);
      }
    });
  });
}
