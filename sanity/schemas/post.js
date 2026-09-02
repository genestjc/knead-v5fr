export default {
  name: "post",
  title: "Post",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: "excerpt",
      title: "Excerpt",
      description:
        "One or two sentences that answer what this story is about. Used as the meta description, the Demeter search result summary, and the text answer engines read when deciding whether to cite the piece. Write it as a standalone claim, not a teaser — 'A Richmond baker spent two years rebuilding a sourdough starter from her grandmother's notes' beats 'You won't believe what she found.'",
      type: "text",
      rows: 3,
      validation: (Rule) => Rule.max(300).warning("Search engines truncate past ~160 characters; answer engines read the whole thing."),
    },
    {
      name: "author",
      title: "Author",
      type: "reference",
      to: { type: "author" },
    },
    {
      name: "mainImage",
      title: "Main image",
      type: "image",
      options: {
        hotspot: true,
      },
    },
    {
      name: "categories",
      title: "Categories",
      type: "array",
      of: [{ type: "reference", to: { type: "category" } }],
    },
    {
      name: "publishedAt",
      title: "Published at",
      type: "datetime",
    },
    {
      name: "body",
      title: "Body",
      type: "blockContent",
    },
    {
      name: "premium",
      title: "Members-Only Content",
      description: "Is this a members-only post that requires a membership to access?",
      type: "boolean",
      initialValue: false,
    },
  ],

  preview: {
    select: {
      title: "title",
      author: "author.name",
      media: "mainImage",
      premium: "premium",
    },
    prepare(selection) {
      const { author, premium } = selection
      return {
        ...selection,
        subtitle: `${premium ? "🔒 Members-Only" : ""} ${author ? `by ${author}` : ""}`.trim(),
      }
    },
  },
}
