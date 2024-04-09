import React from 'react'

export const generateMarkdownTitle = (
  title: string,
): React.ReactElement | React.ReactElement[] => {
  const matches: RegExpMatchArray[] = []
  for (const m of title.matchAll(/`([^`]*)`/g)) {
    matches.push(m)
  }

  if (matches.length === 0) {
    return <>{title}</>
  }

  let i = 0
  let offset = 0
  const nodes: React.ReactElement[] = []
  const matchCount = matches.length

  for (const match of matches) {
    if (match.index === undefined) {
      continue
    }

    i += 1
    if (offset < match.index) {
      nodes.push(
        <React.Fragment key={`0-${i}`}>
          {title.substring(offset, match.index)}
        </React.Fragment>,
      )
    }

    nodes.push(
      <span
        key={`1-${i}`}
        className="dark:bg-polar-700 rounded-md bg-gray-100 px-1.5 py-0.5"
      >
        {match[1]}
      </span>,
    )
    offset = match.index + match[0].length
    if (i === matchCount) {
      nodes.push(
        <React.Fragment key={`3-${i}`}>
          {title.substring(offset, title.length)}
        </React.Fragment>,
      )
    }
  }
  return nodes
}
