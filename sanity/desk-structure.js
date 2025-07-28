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
