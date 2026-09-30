type ModuleLoader = () => Promise<unknown>;

// Preload a little before the target reaches the viewport, so it is always hydrated before a tap can
// land on it.
const ROOT_MARGIN = "256px";

// Holds a module out of the initial load until its target nears view, then upgrades every instance in place.
export function lazyCustomElement(
  hostSelector: string,
  load: ModuleLoader,
  resolveTarget: (host: Element) => Element | null = (host) => host
) {
  let loaded = false;

  const observer = new IntersectionObserver(
    (entries) => {
      if (loaded || !entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      loaded = true;
      observer.disconnect();
      void load();
    },
    { rootMargin: ROOT_MARGIN }
  );

  const wire = () => {
    if (loaded) {
      return;
    }

    document.querySelectorAll(hostSelector).forEach((host) => {
      const target = resolveTarget(host);

      if (target) {
        observer.observe(target);
      }
    });
  };

  wire();
  document.addEventListener("astro:page-load", wire);
}
