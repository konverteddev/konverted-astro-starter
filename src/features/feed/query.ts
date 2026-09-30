import { defineQuery } from "groq";
import { AgentMarkdownFunctions, agentRichText } from "~/features/agents/query";
import { SANITY_ARTICLE_DOCUMENT_TYPE, SANITY_SINGLETON_BLOG_ID, SANITY_SINGLETON_SITE_ID } from "~/sanity/constants";
import { FEED_ITEM_LIMIT } from "./constants";

// Site-wide Basic Auth gates the feed in the middleware; a per-article lock cannot, so protected and noindex ones drop out.
export const FeedXmlQ = defineQuery(`${AgentMarkdownFunctions}
{
  "siteName": *[_type == "${SANITY_SINGLETON_SITE_ID}"][0].name,
  "blog": *[_type == "${SANITY_SINGLETON_BLOG_ID}"][0]{
    title,
    "description": seoMetadata.description
  },
  "items": *[
    _type == "${SANITY_ARTICLE_DOCUMENT_TYPE}"
    && defined(uri.current)
    && defined(publishedAt)
    && seoMetadata.noIndex != true
    && passwordProtected != true
  ] | order(publishedAt desc, _createdAt desc)[0...${FEED_ITEM_LIMIT}]{
    title,
    "href": uri.current,
    publishedAt,
    _updatedAt,
    "description": seoMetadata.description,
    "author": author->name,
    "categories": categories[]->name,
    "content": ${agentRichText("content")}
  }
}`);
