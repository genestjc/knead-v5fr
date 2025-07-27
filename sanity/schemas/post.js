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
    },
    {
      name: "isPremium",
      title: "Premium Content",
      type: "boolean",
      description: "Check this if the content requires membership to view",
      initialValue: false,
    },
    {
      name: "featured",
      title: "Featured",
      type: "boolean",
      description: "Featured posts appear prominently on the homepage",
      initialValue: false,
    },
    {
      name: "seo",
      title: "SEO",
      type: "object",
      fields: [
        {
          name: "metaTitle",
          title: "Meta Title",
          type: "string",
          validation: (Rule) => Rule.max(60).warning("Should be under 60 characters"),
        },
        {
          name: "metaDescription",
          title: "Meta Description",
          type: "text",
          rows: 3,
          validation: (Rule) => Rule.max(160).warning("Should be under 160 characters"),
        },
      ],
    },
  ],

  preview: {
    select: {
      title: "title",
      author: "author.name",
      media: "mainImage",
      isPremium: "isPremium",
      featured: "featured",
    },
    prepare(selection) {
      const { author, isPremium, featured } = selection
      const subtitle = [author && `by ${author}`, isPremium && "🔒 Premium", featured && "⭐ Featured"]
        .filter(Boolean)
        .join(" • ")

      return Object.assign({}, selection, {
        subtitle,
      })
    },
  },

  orderings: [
    {
      title: "Published Date, New",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
    {
      title: "Published Date, Old",
      name: "publishedAtAsc",
      by: [{ field: "publishedAt", direction: "asc" }],
    },
  ],
}
