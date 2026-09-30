import { defineQuery } from "groq";
import { RichTextFunctions, richText } from "~/features/rich-text/fragment";
import {
  SANITY_ARTICLE_CATEGORY_DOCUMENT_TYPE,
  SANITY_ARTICLE_DOCUMENT_TYPE,
  SANITY_SINGLETON_BLOG_ID,
} from "~/sanity/constants";

/**
 * The blog index's own copy plus every article, newest first; `$categories` is the URL's selection.
 * `categories` is derived from the articles, so a chip never appears for a category nothing is filed under.
 */
export const BlogArticleListQ = defineQuery(`${RichTextFunctions}
*[_id == "${SANITY_SINGLETON_BLOG_ID}"][0]{
  heading,
  "intro": ${richText("intro")},
  "articles": *[
    _type == "${SANITY_ARTICLE_DOCUMENT_TYPE}"
    && defined(uri.current)
    && (count($categories) == 0 || count(categories[@->slug.current in $categories]) > 0)
  ] | order(publishedAt desc){
    _id,
    title,
    "href": uri.current,
    publishedAt,
    "author": author->name,
    "categories": categories[]->name,
  },
  "categories": *[
    _type == "${SANITY_ARTICLE_CATEGORY_DOCUMENT_TYPE}"
    && defined(slug.current)
    && _id in *[_type == "${SANITY_ARTICLE_DOCUMENT_TYPE}" && defined(uri.current)].categories[]._ref
  ] | order(name asc){
    "key": _id,
    name,
    "slug": slug.current,
  },
}`);
