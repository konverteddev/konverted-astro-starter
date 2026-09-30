import * as changeCase from "change-case";
import type { StructureBuilder } from "sanity/structure";
import { sanityConfig } from "./config";
import { API_ONLY_DOCUMENTS, SINGLETON_IDS, TEMPLATE_IDS } from "./constants";
import { grouped } from "./structure-groups";

/**
 * Create a list item that maps to a single document.
 * Optionally provide `initialValueTemplate` to prefill the document (e.g. homepage title; URI is set in the template).
 */
function singleton(
  S: StructureBuilder,
  {
    icon,
    title,
    schemaType,
    documentId,
    initialValueTemplate,
  }: {
    title: string;
    schemaType: string;
    documentId: string;
    icon?: () => React.ReactNode;
    initialValueTemplate?: { templateId: string; parameters?: Record<string, unknown> };
  }
) {
  let doc = S.document().schemaType(schemaType).documentId(documentId).title(title);

  if (initialValueTemplate) {
    const { templateId, parameters } = initialValueTemplate;
    doc = doc.initialValueTemplate(templateId, parameters);
  }

  return S.listItem().title(title).id(documentId).icon(icon).child(doc);
}

export function buildStructure(S: StructureBuilder) {
  const items = [
    // Homepage
    singleton(S, {
      title: "Homepage",
      schemaType: "page",
      documentId: SINGLETON_IDS.homepage,
      icon: () => <>🏠</>,
      initialValueTemplate: {
        templateId: TEMPLATE_IDS.pageSingleton,
        parameters: { title: "Homepage" },
      },
    }),

    // All other pages (excludes singletons)
    S.listItem()
      .title("Pages")
      .icon(() => <>📑</>)
      .child(
        S.documentTypeList("page")
          .title("Pages")
          .apiVersion(sanityConfig.apiVersion)
          .filter(
            `_type == 'page' && !(_id in [${Object.values(SINGLETON_IDS)
              .map((id) => `'${id}'`)
              .join(",")}])`
          )
      ),

    // Legal pages are routed by the same catch-all as a page, so they sit beside Pages rather than under their own route.
    S.listItem()
      .title("Legal")
      .icon(() => <>⚖️</>)
      .child(S.documentTypeList("legalPage").title("Legal")),

    // PLOP: Add Structure

    S.divider(),

    // Blog: the index singleton (the article list is rendered by the route) plus its articles.
    S.listItem()
      .title("Blog")
      .icon(() => <>📰</>)
      .child(
        S.list()
          .title("Blog")
          .items([
            singleton(S, {
              title: "Index",
              schemaType: "blog",
              documentId: SINGLETON_IDS.blog,
              icon: () => <>🗞</>,
            }),
            S.listItem()
              .title("Articles")
              .icon(() => <>📖</>)
              .child(S.documentTypeList("article").title("Articles")),
            S.listItem()
              .title("Authors")
              .icon(() => <>👤</>)
              .child(S.documentTypeList("person").title("Authors")),
            S.listItem()
              .title("Article Categories")
              .icon(() => <>🔍</>)
              .child(S.documentTypeList("articleCategory").title("Article Categories")),
          ])
      ),

    S.divider(),

    // Form Submissions (driven by API_ONLY_DOCUMENTS)
    S.listItem()
      .title("Form Submissions")
      .icon(() => <>📥</>)
      .child(
        S.list()
          .title("Form Submissions")
          .items(
            Object.values(API_ONLY_DOCUMENTS).map((schemaType) =>
              S.listItem()
                .title(changeCase.capitalCase(schemaType))
                .icon(() => <>📩</>)
                .child(S.documentTypeList(schemaType).title(changeCase.capitalCase(schemaType)))
            )
          )
      ),

    S.divider(),

    // Site is the copy that renders; its site-wide counterpart is configuration, so it sits next to it rather than inside it.
    singleton(S, {
      title: "Site",
      schemaType: "site",
      documentId: SINGLETON_IDS.site,
      icon: () => <>🎫</>,
    }),

    singleton(S, {
      title: "Settings",
      schemaType: "siteSettings",
      documentId: SINGLETON_IDS.siteSettings,
      icon: () => <>⚙️</>,
    }),
  ];

  return S.list().title("The Content Architecture").items(grouped(items));
}
