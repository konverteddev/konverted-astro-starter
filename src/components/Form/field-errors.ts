// Paints validation onto the fields the markup renders: the message under or on the border, the
// border colour, and the `aria-invalid` a screen reader reads.
type FieldErrors = Partial<Record<string, string>>;

type FieldControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isFieldControl(node: unknown): node is FieldControl {
  return node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement;
}

// A repeated name (a radio or checkbox group) comes back as a list rather than as one control.
function controlsNamed(form: HTMLFormElement, name: string) {
  const found = form.elements.namedItem(name);

  if (isFieldControl(found)) {
    return [found];
  }

  return found instanceof RadioNodeList ? Array.from(found).filter(isFieldControl) : [];
}

/** Repaints every slot the markup renders, so one call flags what is wrong and clears what is not. */
export function setFieldErrors(form: HTMLFormElement, errors: FieldErrors): FieldControl | null {
  let firstInvalid: FieldControl | null = null;

  for (const slot of form.querySelectorAll<HTMLElement>("[data-field-error]")) {
    const name = slot.dataset.fieldError ?? "";
    const message = errors[name];
    const field = slot.closest<HTMLElement>("[data-field]");
    const controls = controlsNamed(form, name);

    slot.textContent = message ?? "";
    field?.toggleAttribute("data-invalid", Boolean(message));

    // One control owns its own `aria-invalid`; for a group it belongs to the group, not to each option.
    const target = controls.length === 1 ? controls[0] : field;

    if (!target) {
      continue;
    }

    if (message) {
      target.setAttribute("aria-invalid", "true");
      firstInvalid ??= controls[0] ?? null;
    } else {
      target.removeAttribute("aria-invalid");
    }
  }

  return firstInvalid;
}
