import { article } from 'polarkit/testdata'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import Markdown from 'markdown-to-jsx'
import { opts } from './EmailRender'
import { RenderArticle, wrapStrictCreateElement } from './markdown'
import { polarPost } from './testdata/polarPost'
import { polarPostUpsellAccess } from './testdata/polarPostUpsellAccess'

const TestRenderer = (props: { article: RenderArticle }) => {
  return (
    <Markdown
      options={{
        ...opts,
        createElement: wrapStrictCreateElement({
          article: props.article,
          extraAllowedCustomComponents: Object.keys(opts.overrides),
        }),
      }}
    >
      {props.article.body}
    </Markdown>
  )
}

test('code', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `
 
code:::

\`\`\`go
func main() {
}
\`\`\`

`,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('posts', () => {
  for (const post of [polarPost, polarPostUpsellAccess]) {
    const { container } = render(
      <TestRenderer
        article={{
          ...article,
          body: post,
        }}
      />,
    )
    expect(container).toMatchSnapshot()
  }
})

test('mermaid', async () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `

we love charts

\`\`\`mermaid
pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15
\`\`\`

`,
      }}
    />,
  )

  expect(container).toMatchSnapshot()
})
