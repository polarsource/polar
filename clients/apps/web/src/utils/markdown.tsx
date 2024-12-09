import { MarkdownToJSX } from 'markdown-to-jsx'

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
  createElement: (tag, props, ...children) => {
    return <span className="[&:not(:first-child)]:ml-1">{children}</span>
  },
}
