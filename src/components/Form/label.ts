// For placeholder text, which has to say what the label says; `FormField` marks up the label itself.
export function fieldLabel(label: string, required?: boolean) {
  return required ? `${label}*` : label;
}
