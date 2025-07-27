/**
 * This is the schema definition for the rich text fields used for
 * for this blog studio. When you import it in schemas.js it can be
 * reused in other parts of the studio with:
 *  {
 *    name: 'someName',
 *    title: 'Some title',
 *    type: 'blockContent'
 *  }
 */
export default {
  title: "Block Content",
  name: "blockContent",
  type: "array",
  of: [
    {
      title: "Block",
      type: "block",
      // Styles let you set what your user can mark up blocks with. These
      // correspond with HTML tags, but you can set any title or value
      // you want and decide how you want to deal with it where you want to
      // use your content.
      styles: [
        { title: "Normal", value: "normal" },
        { title: "H1", value: "h1" },
        { title: "H2", value: "h2" },
        { title: "H3", value: "h3" },
        { title: "H4", value: "h4" },
        { title: "Quote", value: "blockquote" },
        { title: "Large", value: "large" }, // Retained from existing code
      ],
      lists: [
        { title: "Bullet", value: "bullet" },
        { title: "Numbered", value: "number" }, // Retained from existing code
      ],
      // Marks let you mark up inline text in the block editor.
      marks: {
        // Decorators usually describe a single property – e.g. a typographic
        // preference or highlighting by editors.
        decorators: [
          { title: "Strong", value: "strong" },
          { title: "Emphasis", value: "em" },
          { title: "Code", value: "code" }, // Retained from existing code
        ],
        // Annotations can be any object structure – e.g. a link or a footnote.
        annotations: [
          {
            title: "URL",
            name: "link",
            type: "object",
            fields: [
              {
                title: "URL",
                name: "href",
                type: "url",
              },
            ],
          },
          {
            title: "Highlight",
            name: "highlight",
            type: "object",
            fields: [
              {
                title: "Color",
                name: "color",
                type: "string",
                options: {
                  list: [
                    { title: "Yellow", value: "yellow" },
                    { title: "Green", value: "green" },
                    { title: "Blue", value: "blue" },
                    { title: "Pink", value: "pink" },
                  ],
                },
              },
            ],
          }, // Retained from existing code
        ],
      },
    },
    // You can add additional types here. Note that you can't use
    // primitive types such as 'string' and 'number' in the same array
    // as a block type.
    {
      type: "image",
      options: { hotspot: true },
      fields: [
        {
          name: "alt",
          type: "string",
          title: "Alternative Text",
        },
        {
          name: "caption",
          type: "string",
          title: "Caption",
        }, // Retained from existing code
      ],
    },
    {
      name: "youtube",
      type: "object",
      title: "YouTube Video",
      fields: [
        {
          name: "url",
          type: "url",
          title: "YouTube URL",
          description: "Paste the YouTube video URL here",
          validation: (Rule) =>
            Rule.required().custom((url) => {
              if (!url) return true
              const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/
              return youtubeRegex.test(url) || "Please enter a valid YouTube URL"
            }),
        },
        {
          name: "title",
          type: "string",
          title: "Video Title (optional)",
        },
      ],
      preview: {
        select: {
          title: "title",
          url: "url",
        },
        prepare(selection) {
          const { title, url } = selection
          return {
            title: title || "YouTube Video",
            subtitle: url,
            media: () => "🎥",
          }
        },
      },
    }, // Retained from existing code
    {
      name: "instagram",
      type: "object",
      title: "Instagram Post",
      fields: [
        {
          name: "url",
          type: "url",
          title: "Instagram URL",
          description: "Paste the Instagram post URL here (e.g., https://www.instagram.com/p/ABC123/)",
          validation: (Rule) =>
            Rule.required().custom((url) => {
              if (!url) return true
              const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/
              return instagramRegex.test(url) || "Please enter a valid Instagram post URL"
            }),
        },
        {
          name: "caption",
          type: "string",
          title: "Caption (optional)",
        },
      ],
      preview: {
        select: {
          caption: "caption",
          url: "url",
        },
        prepare(selection) {
          const { caption, url } = selection
          return {
            title: caption || "Instagram Post",
            subtitle: url,
            media: () => "📷",
          }
        },
      },
    }, // Retained from existing code
    {
      name: "twitter",
      type: "object",
      title: "X (Twitter) Post",
      fields: [
        {
          name: "url",
          type: "url",
          title: "X/Twitter URL",
          description: "Paste the X (Twitter) post URL here",
          validation: (Rule) =>
            Rule.required().custom((url) => {
              if (!url) return true
              const twitterRegex = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/\d+/
              return twitterRegex.test(url) || "Please enter a valid X/Twitter post URL"
            }),
        },
        {
          name: "caption",
          type: "string",
          title: "Caption (optional)",
        },
      ],
      preview: {
        select: {
          caption: "caption",
          url: "url",
        },
        prepare(selection) {
          const { caption, url } = selection
          return {
            title: caption || "X Post",
            subtitle: url,
            media: () => "🐦",
          }
        },
      },
    }, // Retained from existing code
    {
      name: "pullQuote",
      type: "object",
      title: "Pull Quote",
      fields: [
        {
          name: "text",
          type: "text",
          title: "Quote Text",
          validation: (Rule) => Rule.required(),
        },
        {
          name: "author",
          type: "string",
          title: "Author (optional)",
        },
      ],
      preview: {
        select: {
          text: "text",
          author: "author",
        },
        prepare(selection) {
          const { text, author } = selection
          return {
            title: `"${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`,
            subtitle: author ? `— ${author}` : "Pull Quote",
            media: () => "💬",
          }
        },
      },
    }, // Retained from existing code
    {
      name: "code",
      type: "object",
      title: "Code Block",
      fields: [
        {
          name: "language",
          type: "string",
          title: "Language",
          options: {
            list: [
              { title: "JavaScript", value: "javascript" },
              { title: "TypeScript", value: "typescript" },
              { title: "HTML", value: "html" },
              { title: "CSS", value: "css" },
              { title: "Python", value: "python" },
              { title: "JSON", value: "json" },
              { title: "Bash", value: "bash" },
              { title: "Plain Text", value: "text" },
            ],
          },
        },
        {
          name: "filename",
          type: "string",
          title: "Filename (optional)",
        },
        {
          name: "code",
          type: "text",
          title: "Code",
          validation: (Rule) => Rule.required(),
        },
      ],
      preview: {
        select: {
          language: "language",
          filename: "filename",
          code: "code",
        },
        prepare(selection) {
          const { language, filename, code } = selection
          return {
            title: filename || `${language || "Code"} Block`,
            subtitle: code.substring(0, 50) + (code.length > 50 ? "..." : ""),
            media: () => "💻",
          }
        },
      },
    }, // Retained from existing code
  ],
}
