const NOT_FOUND_MARKDOWN = `# Page not found

There is no page at this URL on polar.sh.

Polar is a payment infrastructure and Merchant of Record for software companies. These pages are a good place to continue:

- [Documentation](https://polar.sh/docs)
- [Documentation index for LLMs](https://polar.sh/llms.txt)
- [API reference](https://polar.sh/docs/api-reference/introduction)
- [Sitemap](https://polar.sh/sitemap.xml)
- [Homepage](https://polar.sh)
`

export function GET() {
  return new Response(NOT_FOUND_MARKDOWN, {
    status: 404,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
    },
  })
}
