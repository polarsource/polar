import { MarkdownToJSX } from 'markdown-to-jsx'
import React from 'react'

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
