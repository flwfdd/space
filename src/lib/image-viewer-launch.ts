let opening = false;

export async function launchImageViewer(
  trigger: HTMLElement,
  open: () => Promise<void>,
): Promise<void> {
  if (opening || document.querySelector(".pswp")) return;
  opening = true;
  trigger.setAttribute("aria-busy", "true");
  try {
    await open();
  } finally {
    opening = false;
    trigger.removeAttribute("aria-busy");
  }
}
