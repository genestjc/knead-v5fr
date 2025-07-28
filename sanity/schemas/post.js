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
      name: "author",
      title: "Author",
      type: "reference",
      to: { type: "author" },
      validation: (Rule) => Rule.required(),
    },
    {
      name: "mainImage",
      title: "Main image",
      type: "image",
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: "alt",
          type: "string",
          title: "Alternative Text",
        },
      ],
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
      validation: (Rule) => Rule.required(),
    },
    {
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 4,
    },
    {
      name: "body",
      title: "Body",
      type: "blockContent",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "isPremium",
      title: "Premium Content",
      type: "boolean",
      description: "Check if this post requires membership to view",
      initialValue: false,
    },
    {
      name: "featured",
      title: "Featured",
      type: "boolean",
      description: "Mark as featured post",
      initialValue: false,
    },
  ],

  preview: {
    select: {
      title: "title",
      author: "author.name",
      media: "mainImage",
      isPremium: "isPremium",
    },
    prepare(selection) {
      const { author, isPremium } = selection
      return Object.assign({}, selection, {
        subtitle: `${author ? `by ${author}` : "No author"}${isPremium ? " • Premium" : ""}`,
      })
    },
  },

  orderings: [
    {
      title: "Publishing date new–old",
      name: "publishingDateAsc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
    {
      title: "Publishing date old–new",
      name: "publishingDateDesc",
      by: [{ field: "publishedAt", direction: "asc" }],
    },
  ],
}
