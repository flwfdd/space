export type InlineMarkdownPart =
  | { type: "text"; value: string }
  | { type: "link"; label: string; href: string };

const LINK_PATTERN = /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:|\/|#)[^\s)]+)\)/g;

export function parseInlineMarkdown(value: string): InlineMarkdownPart[] {
  const parts: InlineMarkdownPart[] = [];
  let cursor = 0;

  for (const match of value.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push({ type: "text", value: value.slice(cursor, index) });
    }

    parts.push({
      type: "link",
      label: match[1],
      href: match[2],
    });
    cursor = index + match[0].length;
  }

  if (cursor < value.length) {
    parts.push({ type: "text", value: value.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value }];
}

export function isExternalHref(href: string): boolean {
  return /^(?:https?:)?\/\//i.test(href);
}
