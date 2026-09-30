import { FormElement } from "~/features/forms/form-element";

export class ContactFormElement extends FormElement {
  protected successMessage = "Thank you! Your message has been sent successfully.";

  protected async loadRules() {
    return (await import("./validate-contact-form")).contactForm;
  }
}

if (!customElements.get("contact-form")) {
  customElements.define("contact-form", ContactFormElement);
}
