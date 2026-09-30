import { defineQuery } from "groq";
import { SECTION_SETTINGS } from "~/features/page-builder/section-layout";
import { RichTextFunctions, richText } from "~/features/rich-text/fragment";
import { link } from "~/features/sanity/link/fragment";
import { MediaFunctions, media } from "~/features/sanity/media/fragment";

// Every section self-fetches its own slice by docId + sectionKey (see the section components).

// Keyed by uri so the route fetches it in parallel, and matched on `uri.current` alone so new routed types are covered.
export const PageSectionsQ = defineQuery(`*[defined(uri.current) && uri.current == $uri][0]
  .pageBuilder.sectionsArray[sectionSettings.disabled != true]{
    _key,
    _type
  }`);

export const TextSectionQ = defineQuery(`${RichTextFunctions}
*[_id == $docId][0].pageBuilder.sectionsArray[_type == "textSectionField" && _key == $sectionKey][0]{
    "content": sectionContent{
      headline,
      "text": ${richText("appRichText")}
    },
    ${SECTION_SETTINGS},
}`);

export const CtaSectionQ = defineQuery(`${RichTextFunctions}
*[_id == $docId][0].pageBuilder.sectionsArray[_type == "ctaSectionField" && _key == $sectionKey][0]{
    "content": sectionContent{
      headline,
      "cta": ${link("appLink")},
      "text": ${richText("appRichText")}
    },
    ${SECTION_SETTINGS}
}`);

export const MediaSectionQ = defineQuery(`${MediaFunctions}
*[_id == $docId][0].pageBuilder.sectionsArray[_type == "mediaSectionField" && _key == $sectionKey][0]{
    "content": sectionContent{
      caption,
      useParallax,
      fullBleed,
      "media": ${media("appMedia")}
    },
    ${SECTION_SETTINGS}
}`);

export const ContactFormSectionQ = defineQuery(`${RichTextFunctions}
*[_id == $docId][0].pageBuilder.sectionsArray[_type == "contactFormSectionField" && _key == $sectionKey][0]{
    "content": sectionContent{
      headline,
      "text": ${richText("appRichText")},
    },
    ${SECTION_SETTINGS},
}`);

export const HeadlineSectionQ =
  defineQuery(`*[_id == $docId][0].pageBuilder.sectionsArray[_type == "headlineSectionField" && _key == $sectionKey][0]{
    "content": sectionContent{
      headline,
    },
    ${SECTION_SETTINGS},
}`);

// PLOP: Add Section Query
