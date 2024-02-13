import { article } from 'polarkit/testdata'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import Markdown from 'markdown-to-jsx'
import { opts } from './EmailRender'
import { RenderArticle, wrapStrictCreateElement } from './markdown'
import { polarPost } from './render.test'

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

test('polar', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: polarPost,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})
