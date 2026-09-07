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
      name: "subjects",
      title: "Subjects",
      description:
        "Who or what this piece is about — the interviewee, the profiled artist, the restaurant. Not the author, and not every name mentioned in passing. This is published as structured data and is what tells an answer engine the piece is journalism about a person, rather than marketing for a product. An interview with a painter about AI is otherwise easy to mistake for an AI art tool.",
      type: "array",
      of: [
        {
          type: "object",
          name: "subject",
          fields: [
            {
              name: "name",
              title: "Name",
              type: "string",
              validation: (Rule) => Rule.required(),
            },
            {
              name: "type",
              title: "Type",
              type: "string",
              options: {
                list: [
                  { title: "Person", value: "Person" },
                  { title: "Organization", value: "Organization" },
                ],
                layout: "radio",
              },
              initialValue: "Person",
              validation: (Rule) => Rule.required(),
            },
          ],
          preview: {
            select: { title: "name", subtitle: "type" },
          },
        },
      ],
    },
    {
      name: "keyFacts",
      title: "Key facts",
      description:
        "The datable, checkable facts this piece establishes — a career before the work, a named studio and where it is, a collection and the year it shipped. Three to six is plenty. These render as a fact box under the image and are published as structured data. This is the field that wins 'who is X' questions: an answer engine assembling a profile pulls from the pieces that name names and dates, and a great interview that never pins a date loses to a thinner one that does.",
      type: "array",
      of: [
        {
          type: "object",
          name: "keyFact",
          fields: [
            {
              name: "fact",
              title: "Fact",
              description:
                "One sentence, specific and checkable. 'Trained as an investment banker before turning to generative art' — not 'has an unconventional background'.",
              type: "string",
              validation: (Rule) => Rule.required().max(200),
            },
            {
              name: "when",
              title: "When",
              description:
                "Optional. A year, month, or range — 2023, 2024-03, 2019–2021. A bare year or year-month is also published in machine-readable form.",
              type: "string",
            },
            {
              name: "sourceUrl",
              title: "Source",
              description: "Optional link supporting the fact.",
              type: "url",
            },
          ],
          preview: {
            select: { title: "fact", subtitle: "when" },
          },
        },
      ],
      validation: (Rule) => Rule.max(8).warning("Past six or so, a fact box stops being scannable."),
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
