import { article } from "./documents/article";
import { articleCategory } from "./documents/article-category";
import { blog } from "./documents/blog";
import { contactFormSubmission } from "./documents/contact-form-submission";
import { imageAltText } from "./documents/image-alt-text";
import { legalPage } from "./documents/legal-page";
import { page } from "./documents/page";
import { person } from "./documents/person";
import { redirect } from "./documents/redirect";
import { site } from "./documents/site";
import { siteSettings } from "./documents/site-settings";
import { appColor } from "./fields/app-color";
import { aspectRatio } from "./fields/aspect-ratio";
import { lottieOptions } from "./fields/lottie-options";
import { riveOptions } from "./fields/rive-options";
import { videoOptions } from "./fields/video-options";
import { sections } from "./page-sections";
// PLOP: Add Import

// All exported schema types will be added to Sanity as first-class citizens.
export const schemaTypes = [
  site,
  siteSettings,
  redirect,
  page,
  legalPage,
  contactFormSubmission,
  imageAltText,
  blog,
  article,
  articleCategory,
  person,
  aspectRatio,
  videoOptions,
  riveOptions,
  lottieOptions,
  appColor,
  // PLOP: Add Export
  ...sections,
];
