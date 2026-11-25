const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!prefersReducedMotion) {
  for (const element of document.querySelectorAll("[data-typed-text]")) {
    const text = element.getAttribute("data-typed-text") ?? "";
    element.textContent = "";
    let index = 0;
    const typeNext = () => {
      element.textContent = text.slice(0, index++);
      if (index <= text.length) window.setTimeout(typeNext, 35);
    };
    typeNext();
  }
}
