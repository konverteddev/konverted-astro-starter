import { defineQuery } from "groq";
import { AuthorFragment } from "~/features/blog/author/fragment";
import { RichTextFunctions, richText } from "~/features/rich-text/fragment";
import { image } from "~/features/sanity/media/fragment";
import { SeoFunctions, SeoMetadataFragment } from "~/features/site/seo/fragment";
import {
  SANITY_ARTICLE_DOCUMENT_TYPE,
  SANITY_BLOG_INDEX_URI,
  SANITY_LEGAL_PAGE_DOCUMENT_TYPE,
  SANITY_PAGE_DOCUMENT_TYPE,
  SANITY_PERSON_DOCUMENT_TYPE,
  SANITY_SINGLETON_BLOG_ID,
} from "~/sanity/constants";

// Route-level queries for the pages model. Fragments live beside their features
// (src/features/**/fragment.ts); section queries live in src/features/page-builder/queries.ts.

// Both catch-all types resolve here: `page` assembles a page builder, `legalPage` is prose in one field.
export const PageQ = defineQuery(`${RichTextFunctions}

  *[_type in ["${SANITY_PAGE_DOCUMENT_TYPE}", "${SANITY_LEGAL_PAGE_DOCUMENT_TYPE}"] && defined(uri.current) && uri.current == $uri][0]{
    _id,
    _type,
    title,
    "uri": coalesce(uri.current, "/"),
    "showHeader": coalesce(showHeader, true),
    "showFooter": coalesce(showFooter, true),
    seoMetadata{${SeoMetadataFragment}},
    _type == "${SANITY_LEGAL_PAGE_DOCUMENT_TYPE}" => {
      "content": ${richText("content")},
    },
  }
`);

export const ArticlePageQ = defineQuery(`${RichTextFunctions}

  *[_type == "article" && defined(uri.current) && uri.current == $uri][0]{
    _id,
    _type,
    title,
    _updatedAt,
    publishedAt,
    author->{ name, "href": uri.current },
    "categories": categories[]->name,
    "image": ${image("image")},
    "blogTitle": *[_id == "${SANITY_SINGLETON_BLOG_ID}"][0].title,
    "uri": coalesce(uri.current, "${SANITY_BLOG_INDEX_URI}"),
    "showHeader": coalesce(showHeader, true),
    "showFooter": coalesce(showFooter, true),
    "content": ${richText("content")},
    seoMetadata{${SeoMetadataFragment}},
  }
`);

// A singleton fetched by id. Its `uri` is read-only, and there is no page builder: the page is always the article list.
export const BlogPageQ = defineQuery(`${SeoFunctions}

  *[_id == "${SANITY_SINGLETON_BLOG_ID}"][0]{
    _id,
    _type,
    title,
    heading,
    "uri": coalesce(uri.current, "${SANITY_BLOG_INDEX_URI}"),
    "showHeader": coalesce(showHeader, true),
    "showFooter": coalesce(showFooter, true),
    seoMetadata{${SeoMetadataFragment}},
  }
`);

// The page and the byline panel render the same profile, so they read the same document through one query.
export const AuthorPageQ = defineQuery(`${RichTextFunctions}

  *[_type == "${SANITY_PERSON_DOCUMENT_TYPE}" && defined(uri.current) && uri.current == $uri][0]{
    ${AuthorFragment}
    _createdAt,
    _updatedAt,
    "showHeader": coalesce(showHeader, true),
    "showFooter": coalesce(showFooter, true),
    "blogTitle": *[_id == "${SANITY_SINGLETON_BLOG_ID}"][0].title,
    seoMetadata{${SeoMetadataFragment}},
    // Matched on the author's URI rather than their id, because under the drafts perspective a
    // document's own id is a draft id while the reference still points at the published one.
    "articles": *[
      _type == "${SANITY_ARTICLE_DOCUMENT_TYPE}"
      && defined(uri.current)
      && author->uri.current == ^.uri.current
    ] | order(publishedAt desc){
      _id,
      title,
      "href": uri.current,
      publishedAt,
      "categories": categories[]->name,
    },
  }
`);

export const SitemapQ = defineQuery(`
  *[defined(uri.current) && seoMetadata.noIndex != true && passwordProtected != true]{
    "uri": uri.current,
    "updatedAt": _updatedAt,
  }
`);

// PLOP: Add Route Query
