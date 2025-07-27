export const structure = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem().title("Posts").child(S.documentTypeList("post").title("Posts").filter('_type == "post"')),
      S.listItem().title("Authors").child(S.documentTypeList("author").title("Authors").filter('_type == "author"')),
      S.listItem()
        .title("Categories")
        .child(S.documentTypeList("category").title("Categories").filter('_type == "category"')),
      S.divider(),
      ...S.documentTypeListItems().filter((listItem) => !["post", "author", "category"].includes(listItem.getId())),
    ])
