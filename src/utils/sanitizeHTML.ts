import DOMPurify from "isomorphic-dompurify";

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      "a",
      "b",
      "i",
      "em",
      "strong",
      "p",
      "br",
      "ul",
      "ol",
      "li",
      "code",
      "pre",
      "img",
      "audio",
      "source",
      "blockquote",
      "span",
      "div",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "target",
      "rel",
      "controls",
      "type",
      "width",
      "height",
      "loading",
      "referrerpolicy",
    ],
    ALLOW_DATA_ATTR: false,
  });
}
