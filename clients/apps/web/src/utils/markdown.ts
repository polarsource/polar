export const firstImageUrlFromMarkdown = (markdown: string) => {
  return markdown.match(/!\[.*?\]\((.*?)\)/)?.[1]
}
