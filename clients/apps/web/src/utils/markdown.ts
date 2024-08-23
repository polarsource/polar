export const firstImageUrlFromMarkdown = (markdown: string): string | null => {
  const imagesMatch = markdown.match(/!\[.*?\]\((.*?)\)/)
  if (!imagesMatch) {
    return null
  }
  return imagesMatch[1]
}
