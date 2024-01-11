import { article } from 'polarkit/testdata'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import Markdown from 'markdown-to-jsx'
import Paywall from './Paywall/Paywall'
import {
  RenderArticle,
  markdownOpts,
  wrapStrictCreateElement,
} from './markdown'

// Currently unable to use any of the "real" renderers, as we can't import the syntax highlighter in jest (?)
const opts = {
  ...markdownOpts,
  overrides: {
    ...markdownOpts.overrides,
  },
} as const

const TestRenderer = (props: { article: RenderArticle }) => {
  return (
    <Markdown
      options={{
        ...opts,
        overrides: {
          ...opts.overrides,
          pre: () => <></>,
          Paywall: (args: any) => <Paywall {...args} />,
        },

        createElement: wrapStrictCreateElement({
          article: props.article,
        }),
      }}
    >
      {props.article.body}
    </Markdown>
  )
}

test('demo', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `
  # h1

  ## h2
  
  ### h3

  Hello **world**!

  [Polar](https://polar.sh/)

  <Paywall></Paywall>
  
  `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})
