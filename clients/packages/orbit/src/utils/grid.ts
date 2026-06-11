// Strongly-typed grid line & placement values, shared by Grid and GridItem.
//
// Track *lists* (e.g. `repeat(3, 1fr)`, `1fr 2fr auto`, `minmax(100px, 1fr)`)
// are open-ended CSS and intentionally stay typed as `string`. The values
// below, however, have a small finite grammar, so they're constrained to catch
// typos like `column="foo"`.

/** A single grid line: a (possibly negative) line number, `auto`, or a span. */
export type GridLine = number | 'auto' | `span ${number}`

/** A `grid-column` / `grid-row` value: a single line, or `<start> / <end>`. */
export type GridPlacement = GridLine | `${GridLine} / ${GridLine}`
