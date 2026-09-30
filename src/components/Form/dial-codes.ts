import type { FormOption } from "./FormDropdown.astro";

/**
 * One entry per dial code, so a server never has to guess which country a shared code (+1) came from.
 * The label carries the ISO code because a closed select shows only the bare code.
 */
export const DIAL_CODES: FormOption[] = [
  { value: "+1", label: "+1 (US)" },
  { value: "+44", label: "+44 (UK)" },
  { value: "+61", label: "+61 (AU)" },
  { value: "+43", label: "+43 (AT)" },
  { value: "+32", label: "+32 (BE)" },
  { value: "+359", label: "+359 (BG)" },
  { value: "+385", label: "+385 (HR)" },
  { value: "+357", label: "+357 (CY)" },
  { value: "+420", label: "+420 (CZ)" },
  { value: "+45", label: "+45 (DK)" },
  { value: "+372", label: "+372 (EE)" },
  { value: "+358", label: "+358 (FI)" },
  { value: "+33", label: "+33 (FR)" },
  { value: "+49", label: "+49 (DE)" },
  { value: "+30", label: "+30 (GR)" },
  { value: "+852", label: "+852 (HK)" },
  { value: "+36", label: "+36 (HU)" },
  { value: "+353", label: "+353 (IE)" },
  { value: "+39", label: "+39 (IT)" },
  { value: "+81", label: "+81 (JP)" },
  { value: "+371", label: "+371 (LV)" },
  { value: "+370", label: "+370 (LT)" },
  { value: "+352", label: "+352 (LU)" },
  { value: "+356", label: "+356 (MT)" },
  { value: "+31", label: "+31 (NL)" },
  { value: "+47", label: "+47 (NO)" },
  { value: "+48", label: "+48 (PL)" },
  { value: "+351", label: "+351 (PT)" },
  { value: "+40", label: "+40 (RO)" },
  { value: "+65", label: "+65 (SG)" },
  { value: "+421", label: "+421 (SK)" },
  { value: "+386", label: "+386 (SI)" },
  { value: "+34", label: "+34 (ES)" },
  { value: "+46", label: "+46 (SE)" },
  { value: "+41", label: "+41 (CH)" },
  { value: "+971", label: "+971 (AE)" },
];

export const DEFAULT_DIAL_CODE = "+1";
