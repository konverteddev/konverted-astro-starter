// JSON-LD builders. Framework-free and Sanity-free: callers pass resolved strings so the shapes stay testable.

export type JsonLd = Record<string, unknown>;

type OrganizationInput = {
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
};

type WebSiteInput = {
  name: string;
  url: string;
  description?: string;
};

type WebPageInput = {
  name?: string;
  url: string;
  description?: string;
  siteUrl: string;
};

type Crumb = {
  name: string;
  url?: string;
};

type BlogInput = {
  name?: string;
  url: string;
  description?: string;
  siteUrl: string;
};

type ProfilePageInput = {
  name?: string;
  url: string;
  description?: string;
  siteUrl: string;
  /** The `@id` of the Person node the page profiles. */
  mainEntityId: string;
  dateCreated?: string;
  dateModified?: string;
};

type ListEntry = {
  url: string;
  name?: string;
};

type ItemListInput = {
  /** The `@id` of the WebPage the list is rendered on, so the two nodes are one page, not two. */
  pageId: string;
  id: string;
  name?: string;
  items: ListEntry[];
};

type BlogPostingInput = {
  headline?: string;
  url: string;
  siteUrl: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  /** The author's own page, when they have one; it gives the Person node a stable identity across articles. */
  authorUrl?: string;
  image?: string;
  articleSection?: string[];
};

type PersonInput = {
  name?: string;
  url: string;
  siteUrl: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  sameAs?: string[];
};

const IN_LANGUAGE = "en";

// Drops undefined/empty members so a half-populated CMS never emits `"logo": null`, which validators reject.
function compact(value: JsonLd): JsonLd {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "" && !isEmptyArray(entry))
  );
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

export function organizationLd({ name, url, logo, sameAs }: OrganizationInput): JsonLd {
  return compact({
    "@type": "Organization",
    "@id": `${url}/#organization`,
    name,
    url,
    logo,
    sameAs,
  });
}

export function webSiteLd({ name, url, description }: WebSiteInput): JsonLd {
  return compact({
    "@type": "WebSite",
    "@id": `${url}/#website`,
    url,
    name,
    description,
    publisher: { "@id": `${url}/#organization` },
    inLanguage: IN_LANGUAGE,
  });
}

/** Each page carries its own `@id` so no two URLs share a WebPage identity. */
export function webPageLd({ name, url, description, siteUrl }: WebPageInput): JsonLd {
  return compact({
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: { "@id": `${siteUrl}/#website` },
    about: { "@id": `${siteUrl}/#organization` },
    inLanguage: IN_LANGUAGE,
  });
}

/** `mainEntity` is what tells a crawler the page IS the profile, not a page that mentions someone. */
export function profilePageLd({
  name,
  url,
  description,
  siteUrl,
  mainEntityId,
  dateCreated,
  dateModified,
}: ProfilePageInput): JsonLd {
  return compact({
    "@type": "ProfilePage",
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    dateCreated,
    dateModified,
    mainEntity: { "@id": mainEntityId },
    isPartOf: { "@id": `${siteUrl}/#website` },
    publisher: { "@id": `${siteUrl}/#organization` },
    inLanguage: IN_LANGUAGE,
  });
}

/** The blog index as a collection in its own right, so the listing is not just another `WebPage`. */
export function blogLd({ name, url, description, siteUrl }: BlogInput): JsonLd {
  return compact({
    "@type": "Blog",
    "@id": `${url}#blog`,
    url,
    name,
    description,
    isPartOf: { "@id": `${siteUrl}/#website` },
    publisher: { "@id": `${siteUrl}/#organization` },
    inLanguage: IN_LANGUAGE,
  });
}

/** `mainEntityOfPage` ties the work to the page, so a crawler reads one article on one URL rather than two competing descriptions. */
export function blogPostingLd({
  headline,
  url,
  siteUrl,
  description,
  datePublished,
  dateModified,
  authorName,
  authorUrl,
  image,
  articleSection,
}: BlogPostingInput): JsonLd {
  return compact({
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    url,
    headline,
    description,
    datePublished,
    dateModified,
    image,
    author: authorName
      ? compact({ "@type": "Person", "@id": authorUrl ? `${authorUrl}#person` : undefined, name: authorName, url: authorUrl })
      : undefined,
    publisher: { "@id": `${siteUrl}/#organization` },
    isPartOf: { "@id": `${url}#webpage` },
    mainEntityOfPage: { "@id": `${url}#webpage` },
    articleSection,
    inLanguage: IN_LANGUAGE,
  });
}

/** A filtered view emits the filtered set: claiming items a visitor cannot see is a spam signal. URLs, not nested nodes. */
export function itemListLd({ pageId, id, name, items }: ItemListInput): JsonLd {
  return compact({
    "@type": "ItemList",
    "@id": id,
    name,
    mainEntityOfPage: { "@id": pageId },
    // Newest first, matching the query's `order(publishedAt desc)`.
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) =>
      compact({
        "@type": "ListItem",
        position: index + 1,
        url: item.url,
        name: item.name,
      })
    ),
  });
}

/** A shared `@id`, so a crawler reads one person writing several articles rather than a new anonymous byline per post. */
export function personLd({ name, url, siteUrl, jobTitle, description, image, sameAs }: PersonInput): JsonLd {
  return compact({
    "@type": "Person",
    "@id": `${url}#person`,
    name,
    url,
    jobTitle,
    description,
    image,
    sameAs,
    worksFor: { "@id": `${siteUrl}/#organization` },
    mainEntityOfPage: { "@id": `${url}#webpage` },
  });
}

/** Unnamed crumbs are dropped, so an unpopulated CMS label shortens the trail rather than emitting a blank rung. */
export function breadcrumbLd(crumbs: Crumb[]): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs
      .filter((crumb) => crumb.name !== "")
      .map((crumb, index) =>
        compact({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.url,
        })
      ),
  };
}

/** Takes `object` rather than `JsonLd`, so a repo can mix in `schema-dts`-typed nodes, whose leaf types carry no index signature. */
export function jsonLdGraph(nodes: object[]): JsonLd {
  return { "@context": "https://schema.org", "@graph": nodes };
}
