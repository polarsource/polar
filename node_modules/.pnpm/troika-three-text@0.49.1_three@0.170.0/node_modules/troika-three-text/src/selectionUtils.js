//=== Utility functions for dealing with carets and selection ranges ===//

/**
 * @typedef {object} TextCaret
 * @property {number} x - x position of the caret
 * @property {number} y - y position of the caret's bottom
 * @property {number} height - height of the caret
 * @property {number} charIndex - the index in the original input string of this caret's target
 *   character; the caret will be for the position _before_ that character.
 */

/**
 * Given a local x/y coordinate in the text block plane, find the nearest caret position.
 * @param {TroikaTextRenderInfo} textRenderInfo - a result object from TextBuilder#getTextRenderInfo
 * @param {number} x
 * @param {number} y
 * @return {TextCaret | null}
 */
export function getCaretAtPoint(textRenderInfo, x, y) {
  let closestCaret = null
  const rows = groupCaretsByRow(textRenderInfo)

  // Find nearest row by y first
  let closestRow = null
  rows.forEach(row => {
    if (!closestRow || Math.abs(y - (row.top + row.bottom) / 2) < Math.abs(y - (closestRow.top + closestRow.bottom) / 2)) {
      closestRow = row
    }
  })

  // Then find closest caret by x within that row
  closestRow.carets.forEach(caret => {
    if (!closestCaret || Math.abs(x - caret.x) < Math.abs(x - closestCaret.x)) {
      closestCaret = caret
    }
  })
  return closestCaret
}


const _rectsCache = new WeakMap()

/**
 * Given start and end character indexes, return a list of rectangles covering all the
 * characters within that selection.
 * @param {TroikaTextRenderInfo} textRenderInfo
 * @param {number} start - index of the first char in the selection
 * @param {number} end - index of the first char after the selection
 * @return {Array<{left, top, right, bottom}> | null}
 */
export function getSelectionRects(textRenderInfo, start, end) {
  let rects
  if (textRenderInfo) {
    // Check cache - textRenderInfo is frozen so it's safe to cache based on it
    let prevResult = _rectsCache.get(textRenderInfo)
    if (prevResult && prevResult.start === start && prevResult.end === end) {
      return prevResult.rects
    }

    const {caretPositions} = textRenderInfo

    // Normalize
    if (end < start) {
      const s = start
      start = end
      end = s
    }
    start = Math.max(start, 0)
    end = Math.min(end, caretPositions.length + 1)

    // Build list of rects, expanding the current rect for all characters in a run and starting
    // a new rect whenever reaching a new line or a new bidi direction
    rects = []
    let currentRect = null
    for (let i = start; i < end; i++) {
      const x1 = caretPositions[i * 4]
      const x2 = caretPositions[i * 4 + 1]
      const left = Math.min(x1, x2)
      const right = Math.max(x1, x2)
      const bottom = caretPositions[i * 4 + 2]
      const top = caretPositions[i * 4 + 3]
      if (!currentRect || bottom !== currentRect.bottom || top !== currentRect.top || left > currentRect.right || right < currentRect.left) {
        currentRect = {
          left: Infinity,
          right: -Infinity,
          bottom,
          top,
        }
        rects.push(currentRect)
      }
      currentRect.left = Math.min(left, currentRect.left)
      currentRect.right = Math.max(right, currentRect.right)
    }

    // Merge any overlapping rects, e.g. those formed by adjacent bidi runs
    rects.sort((a, b) => b.bottom - a.bottom || a.left - b.left)
    for (let i = rects.length - 1; i-- > 0;) {
      const rectA = rects[i]
      const rectB = rects[i + 1]
      if (rectA.bottom === rectB.bottom && rectA.top === rectB.top && rectA.left <= rectB.right && rectA.right >= rectB.left) {
        rectB.left = Math.min(rectB.left, rectA.left)
        rectB.right = Math.max(rectB.right, rectA.right)
        rects.splice(i, 1)
      }
    }

    _rectsCache.set(textRenderInfo, {start, end, rects})
  }
  return rects
}

const _caretsByRowCache = new WeakMap()

/**
 * Group a set of carets by row of text, caching the result. A single row of text may contain carets of
 * differing positions/heights if it has multiple fonts, and they may overlap slightly across rows, so this
 * uses an assumption of "at least overlapping by half" to put them in the same row.
 * @return Array<{bottom: number, top: number, carets: TextCaret[]}>
 */
function groupCaretsByRow(textRenderInfo) {
  // textRenderInfo is frozen so it's safe to cache based on it
  let rows = _caretsByRowCache.get(textRenderInfo)
  if (!rows) {
    rows = []
    const {caretPositions} = textRenderInfo
    let curRow

    const visitCaret = (x, bottom, top, charIndex) => {
      // new row if not overlapping by at least half
      if (!curRow || (top < (curRow.top + curRow.bottom) / 2)) {
        rows.push(curRow = {bottom, top, carets: []})
      }
      // expand vertical limits if necessary
      if (top > curRow.top) curRow.top = top
      if (bottom < curRow.bottom) curRow.bottom = bottom
      curRow.carets.push({
        x,
        y: bottom,
        height: top - bottom,
        charIndex,
      })
    }

    let i = 0
    for (; i < caretPositions.length; i += 4) {
      visitCaret(caretPositions[i], caretPositions[i + 2], caretPositions[i + 3], i / 4)
    }
    // Add one more caret after the final char
    visitCaret(caretPositions[i - 3], caretPositions[i - 2], caretPositions[i - 1], i / 4)
  }
  _caretsByRowCache.set(textRenderInfo, rows)
  return rows
}
