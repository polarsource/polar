// Regex that matches references, but not footnotes.
//
// Examples:
//
// [reference]: https://polar.sh
// [reference]: https://polar.sh
// [3]: <https://polar.sh> "Polar"
//
// Does not matches footnotes:
//
// [^4]: footnote
const referencesMatch = /^\[[^\^](.*)\]: (.*)$/gm

export const getReferences = (body: string): string[] => {
  const matches = body.matchAll(referencesMatch)

  const res: string[] = []

  for (const m of matches) {
    res.push(m[0])
  }

  return res
}

export type AbbreviatedContentResult = {
  body: string
  manualBoundary: boolean
  matchedBoundary?: string
}

// must be synced with Article.abbreviated_content on the backend
export const abbreviatedContent = ({
  body,
  includeBoundaryInBody,
  includeRefs,
}: {
  body: string
  includeBoundaryInBody: boolean
  includeRefs?: boolean
}): AbbreviatedContentResult => {
  const res = parseBoundary({ body, includeBoundaryInBody })

  // Add references that would otherwise end up below the boundary
  if (includeRefs) {
    res.body += '\n\n' + getReferences(body).join('\n')
  }

  return res
}

const parseBoundary = ({
  body,
  includeBoundaryInBody,
}: {
  body: string
  includeBoundaryInBody: boolean
}): AbbreviatedContentResult => {
  const res: string[] = []
  let l = 0

  // If the post has a <hr> within 1000 characters, use that as the limit.

  const boundaries = ['---\n', '<hr>\n', '<hr/>\n', '<hr />\n']

  let firstAt: number | undefined = undefined
  let firstBoundary: string | undefined = undefined

  for (const b of boundaries) {
    const idx = body.indexOf(b)
    if (idx >= 0) {
      if (firstAt === undefined || idx < firstAt) {
        firstAt = idx
        firstBoundary = b
      }
    }
  }

  // Support for more than three dashes in a row, "-----\n" is also a boundary
  if (firstAt && firstBoundary === '---\n') {
    let newFirstAt = firstAt
    while (body.at(newFirstAt - 1) === '-') {
      newFirstAt--
    }
    firstBoundary = body.substring(newFirstAt, firstAt + firstBoundary.length)
    firstAt = newFirstAt
  }

  if (firstAt !== undefined && firstBoundary !== undefined && firstAt < 1000) {
    let retbod = body.substring(0, firstAt).trimEnd()
    if (includeBoundaryInBody) {
      retbod = body.substring(0, firstAt + firstBoundary.length)
    }

    return {
      body: retbod,
      manualBoundary: true,
      matchedBoundary: firstBoundary,
    }
  }

  const parts = body.substring(0, 1000).replaceAll('\r\n', '\n').split('\n\n')

  for (const p of parts) {
    if (p.length + l > 500 && l > 0) {
      break
    }

    l += p.length
    res.push(p)
  }

  return { body: res.join('\n\n').trimEnd(), manualBoundary: false }
}
