import type { ColumnSchema } from "@/types"

/** Names that usually hold a row's main text, most likely first. */
const TEXT_NAMES = [
  "text", "content", "body", "message", "sentence", "document", "passage", "comment", "review", "post",
  "tweet", "prompt", "question", "instruction", "input", "description", "summary", "title", "name",
]
const TEXT_SUFFIX = /[_\s-](text|content|body|message)$/i
const NOT_TEXT = /date|time|id$|_id|url|path/i

/** The column that best represents a row's text: a well-known name, else a string column named like `*_text`. */
export function mainTextColumn(schema: ColumnSchema[]): string | undefined {
  const strings = schema.filter((c) => c.type === "string")
  const byName = new Map(strings.map((c) => [c.name.toLowerCase(), c.name]))
  for (const name of TEXT_NAMES) {
    const match = byName.get(name)
    if (match) return match
  }
  return strings.find((c) => TEXT_SUFFIX.test(c.name) && !NOT_TEXT.test(c.name))?.name
}

/** The schema with its main text column moved to the front; other columns keep their order. */
export function textFirst(schema: ColumnSchema[]): ColumnSchema[] {
  const main = mainTextColumn(schema)
  if (!main) return schema
  return [...schema.filter((c) => c.name === main), ...schema.filter((c) => c.name !== main)]
}
