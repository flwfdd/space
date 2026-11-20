const TRIGGER_SELECTOR = ".prose img, .prose pre.mermaid";

function canPreview(element: HTMLElement): boolean {
  return !(element instanceof HTMLImageElement && element.closest("a"));
}

function previewLabel(element: HTMLElement): string {
  if (!(element instanceof HTMLImageElement)) return "放大 Mermaid 图表";
  return element.alt ? `放大图片：${element.alt}` : "放大图片";
}

async function openPreview(trigger: HTMLElement) {
  if (trigger.dataset.previewLoading) return;
  trigger.dataset.previewLoading = "true";
  trigger.setAttribute("aria-busy", "true");
  try {
    const { openMediaLightbox } = await import("./media-lightbox");
    openMediaLightbox(trigger);
  } catch (error) {
    console.error("媒体预览加载失败", error);
    if (trigger instanceof HTMLImageElement) {
      window.open(trigger.currentSrc || trigger.src, "_blank", "noopener");
    }
  } finally {
    delete trigger.dataset.previewLoading;
    trigger.removeAttribute("aria-busy");
  }
}

export function initMediaPreview(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR).forEach((trigger) => {
    if (!canPreview(trigger) || trigger.dataset.previewBound) return;
    trigger.dataset.previewBound = "true";
    trigger.classList.add("media-preview-trigger");
    trigger.tabIndex = 0;
    trigger.setAttribute("role", "button");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-label", previewLabel(trigger));

    trigger.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("button, a")) return;
      void openPreview(trigger);
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      void openPreview(trigger);
    });
  });
}
