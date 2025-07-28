export const structure = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("Posts")
        .child(S.documentTypeList("post").title("Posts").filter('_type == "post" && !(_id in path("drafts.**"))')),
      S.listItem()
        .title("Draft Posts")
        .child(S.documentTypeList("post").title("Draft Posts").filter('_type == "post" && _id in path("drafts.**")')),
      S.divider(),
      S.listItem().title("Authors").child(S.documentTypeList("author").title("Authors")),
      S.listItem().title("Categories").child(S.documentTypeList("category").title("Categories")),
    ])
