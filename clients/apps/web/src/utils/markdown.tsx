import { MarkdownToJSX } from 'markdown-to-jsx'
import React from 'react'

// Detects block-level Markdown (skips the inline elements like *emphasis* and **strong**)
export const hasMarkdown = (text: string): boolean => {
  const markdownPattern =
    /(^#{1,6}\s|(?:^|\n)\s*[-*+]\s|(?:^|\n)\s*\d+\.\s|\[.+\]\(.+\)|(?:^|\n)>\s|`[^`]+`|!\[.*\]\(.*\))/m
  return markdownPattern.test(text)
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
