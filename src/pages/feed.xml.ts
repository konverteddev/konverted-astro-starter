import type { APIRoute } from "astro";
import { FEED_MIME } from "~/features/feed/constants";
import { FeedXmlQ } from "~/features/feed/query";
import { feedTitle } from "~/features/feed/title";
import { renderFeed } from "~/features/feed/xml";
import { CACHE_TTL, SITE_WIDE_CACHE_TAGS } from "~/lib/cache";
import { PUBLIC_SITE_URL } from "~/lib/env";
import {
  SANITY_ARTICLE_CATEGORY_DOCUMENT_TYPE,
  SANITY_ARTICLE_DOCUMENT_TYPE,
  SANITY_BLOG_INDEX_URI,
  SANITY_PERSON_DOCUMENT_TYPE,
  SANITY_SINGLETON_BLOG_ID,
} from "~/sanity/constants";
import type { FeedXmlQResult } from "~/sanity/types";
import { loadQuery } from "../sanity/lib/load-query";

// RSS 2.0 feed of the blog. No draft props: the feed is always the published perspective.
export const GET: APIRoute = async ({ cache }) => {
  // Items carry the article, its author's name and its categories' names; the channel is titled by the blog singleton.
  cache.set({
    ...CACHE_TTL,
    tags: [
      SANITY_ARTICLE_DOCUMENT_TYPE,
      SANITY_ARTICLE_CATEGORY_DOCUMENT_TYPE,
      SANITY_PERSON_DOCUMENT_TYPE,
      SANITY_SINGLETON_BLOG_ID,
      ...SITE_WIDE_CACHE_TAGS,
    ],
  });

  const { data } = await loadQuery<FeedXmlQResult>({ query: FeedXmlQ });

  const title = feedTitle(data.siteName, data.blog?.title);

  const xml = renderFeed(
    {
      title,
      description: data.blog?.description ?? `The latest from ${title}.`,
      path: SANITY_BLOG_INDEX_URI,
      items: data.items,
    },
    PUBLIC_SITE_URL
  );

  return new Response(xml, { headers: { "content-type": `${FEED_MIME}; charset=utf-8` } });
};
