/**
 * The brand ramp the Studio offers for content colour. Semantic tokens are excluded: they carry meaning, not a colour.
 * `name` is stored, not the hex, so editing the token in the app's stylesheet reaches published content.
 */
export type BrandColor = {
  name: string;
  title: string;
  swatch: string;
};

export const BRAND_COLORS: readonly BrandColor[] = [
  { name: "brand-black", title: "Black", swatch: "#000" },
  { name: "brand-white", title: "White", swatch: "#fff" },
  { name: "brand-white-10", title: "White 10%", swatch: "rgb(255 255 255 / 0.1)" },
  { name: "brand-white-5", title: "White 5%", swatch: "rgb(255 255 255 / 0.05)" },
  { name: "brand-off-white", title: "Off White", swatch: "#f2f0ed" },
  { name: "brand-grey", title: "Grey", swatch: "#8a8a8a" },
  { name: "brand-accent", title: "Accent", swatch: "#ff9100" },
];

export function findBrandColor(name: string | undefined): BrandColor | undefined {
  return BRAND_COLORS.find((color) => color.name === name);
}
