/** Keyframes the live figures use, and a drawing held back until it is traced in, its frame excepted. */
export const READER_CSS = `
@keyframes fg-travel { from { offset-distance: 0% } to { offset-distance: 100% } }
@keyframes fg-appear { from { opacity: 0 } to { opacity: 1 } }
[data-undrawn] svg :is(path, line, polyline, polygon, circle, ellipse, rect, text, image, use):not([data-frame] *) { opacity: 0 }
`
