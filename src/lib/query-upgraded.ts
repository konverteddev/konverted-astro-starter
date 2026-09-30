// A descendant custom element is still a plain HTMLElement while an ancestor's `connectedCallback`
// runs after a router swap, so upgrade the match first and take the class to guarantee the tag is defined.

type ElementClass<T extends HTMLElement> = abstract new () => T;

export function queryUpgraded<T extends HTMLElement>(
  scope: ParentNode,
  selector: string,
  elementClass: ElementClass<T>
): T | null {
  const found = scope.querySelector(selector);

  if (!(found instanceof HTMLElement)) {
    return null;
  }

  customElements.upgrade(found);

  return found instanceof elementClass ? found : null;
}

export function queryAllUpgraded<T extends HTMLElement>(scope: ParentNode, selector: string, elementClass: ElementClass<T>): T[] {
  const upgraded: T[] = [];

  for (const found of scope.querySelectorAll(selector)) {
    if (found instanceof HTMLElement) {
      customElements.upgrade(found);
    }

    if (found instanceof elementClass) {
      upgraded.push(found);
    }
  }

  return upgraded;
}
