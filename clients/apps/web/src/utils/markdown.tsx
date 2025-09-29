import { MarkdownToJSX } from 'markdown-to-jsx'
import React from 'react'

export const firstImageUrlFromMarkdown = (markdown: string): string | null => {
  const imagesMatch = markdown.match(/!\[.*?\]\((.*?)\)/)
  if (!imagesMatch) {
    return null
  }
  return imagesMatch[1]
}

export const markdownOptions: MarkdownToJSX.Options = {
  disableParsingRawHTML: true,
  forceBlock: false,
  wrapper: React.Fragment,
  overrides: {
    embed: () => <></>,
    iframe: () => <></>,
    a: (props) => (
      <a
        {...props}
        rel="noopener noreferrer nofollow"
        target="_blank"
        className="text-blue-400 transition-opacity duration-200 hover:opacity-50"
      />
    ),
  },
}

export const markdownOptionsJustText: MarkdownToJSX.Options = {
  ...markdownOptions,
  wrapper: ({ children }) => <>{children}</>,
  createElement: (_, __, ...children) => {
    return <span className="not-first:ml-1">{children}</span>
  },
}
