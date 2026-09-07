import { DraftCheckView } from "./components/DraftCheckView"

/**
 * Adds an "AEO check" tab beside the form on posts.
 *
 * The check has to live where the writing happens. An editor is never going to
 * open an engineering console to find out their excerpt is missing, and by the
 * time a published page can be audited the crawl has already happened.
 */
export const defaultDocumentNode = (S, { schemaType }) => {
  if (schemaType === "post") {
    return S.document().views([
      S.view.form(),
      S.view.component(DraftCheckView).title("AEO check").id("aeo-check"),
    ])
  }
  return S.document().views([S.view.form()])
}

export const structure = (S) =>
  S.list()
    .title("Content")
    .items([
      // Regular document types
      S.listItem()
        .title("Posts")
        .schemaType("post")
        .child(S.documentTypeList("post").title("Posts")),

      S.listItem().title("Authors").schemaType("author").child(S.documentTypeList("author").title("Authors")),

      S.listItem().title("Categories").schemaType("category").child(S.documentTypeList("category").title("Categories")),

      // Add a divider
      S.divider(),

      // Add a "Released" section that shows all released documents
      S.listItem()
        .title("Released")
        .child(
          S.list()
            .title("Released Documents")
            .items([
              S.listItem()
                .title("Released Posts")
                .child(
                  S.documentTypeList("post").title("Released Posts").filter('_type == "post" && defined(publishedAt)'),
                ),
            ]),
        ),
    ])
