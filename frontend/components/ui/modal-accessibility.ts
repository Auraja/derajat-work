type BackgroundState = {
  element: HTMLElement;
  hadInert: boolean;
  ariaHidden: string | null;
};

export function makeBackgroundInert(overlay: HTMLElement) {
  const states: BackgroundState[] = [];
  let foreground: HTMLElement = overlay;

  while (foreground.parentElement) {
    const parent = foreground.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === foreground || !(sibling instanceof HTMLElement)) continue;
      states.push({
        element: sibling,
        hadInert: sibling.hasAttribute("inert"),
        ariaHidden: sibling.getAttribute("aria-hidden"),
      });
      sibling.setAttribute("inert", "");
      sibling.setAttribute("aria-hidden", "true");
    }
    foreground = parent;
    if (parent === document.body) break;
  }

  return () => {
    for (const { element, hadInert, ariaHidden } of states) {
      if (!hadInert) element.removeAttribute("inert");
      if (ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", ariaHidden);
    }
  };
}
