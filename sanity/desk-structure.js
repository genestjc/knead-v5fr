export const structure = (S) =>
  S.list()
    .title("Content")
    .items([
      // Posts
      S.listItem()
        .title("Posts")
        .child(
          S.documentTypeList("post")
            .title("Posts")
            .filter('_type == "post"')
            .defaultOrdering([{ field: "publishedAt", direction: "desc" }]),
        ),

      // Authors
      S.listItem()
        .title("Authors")
        .child(S.documentTypeList("author").title("Authors").filter('_type == "author"')),

      // Categories
      S.listItem()
        .title("Categories")
        .child(S.documentTypeList("category").title("Categories").filter('_type == "category"')),

      // Divider
      S.divider(),

      // All other document types
      ...S.documentTypeListItems().filter((listItem) => !["post", "author", "category"].includes(listItem.getId())),
    ])
