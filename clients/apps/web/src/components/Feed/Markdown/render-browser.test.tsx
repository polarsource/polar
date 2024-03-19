import { article } from 'polarkit/testdata'

import { PolarQueryClientProvider } from '@/app/providers'
import '@testing-library/jest-dom'
import { act, render } from '@testing-library/react'
import Markdown from '@zegl/markdown-to-jsx'
import { opts } from './BrowserRender'
import { RenderArticle, wrapStrictCreateElement } from './markdown'
import { polarPostUpsellAccess } from './testdata/polarPostUpsellAccess'

const TestRenderer = (props: { article: RenderArticle }) => {
  return (
    <PolarQueryClientProvider>
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
    </PolarQueryClientProvider>
  )
}

test('code', async () => {
  let asFragment

  await act(() => {
    const component = render(
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
    asFragment = component.asFragment
  })

  // @ts-ignore
  expect(asFragment()).toMatchSnapshot()
})

test('XSS', async () => {
  let asFragment

  await act(() => {
    const component = render(
      <TestRenderer
        article={{
          ...article,
          body: `
 
<p>
hello
</p>

<p onload="alert(1)">
what
</p>
    
<table>
    <thead>
        <tr><th>TH</th></tr>
    </thead>
    <tbody onload="alert(2)">
        <tr onload="alert(3)"><td onload="alert(4)">TD</td></tr>
        <tr><td><p onload="alert(1)"><img src="not-sanitized" onclick="xxx" /> <a href="javascript:alert(1)">clickme</a> <span onclick="xxx">clickmep</span></p></td><td onclick="x">TD</td></tr>
    </tbody>
</table>

`,
        }}
      />,
    )
    asFragment = component.asFragment
  })

  // @ts-ignore
  expect(asFragment()).toMatchSnapshot()
})

test('basic', async () => {
  let asFragment

  await act(() => {
    const component = render(
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

This is a normal **block** of text [Polar](https://polar.sh/) with _various_ formatting.
And here it continues in the same block.

This is a different block.  
With a linebreak! (double whitespace)

> This is a quoute!

`,
        }}
      />,
    )
    asFragment = component.asFragment
  })

  // @ts-ignore
  expect(asFragment()).toMatchSnapshot()
})

test('posts', async () => {
  let asFragment

  await act(() => {
    const component = render(
      <TestRenderer
        article={{
          ...article,
          body: polarPostUpsellAccess,
        }}
      />,
    )
    asFragment = component.asFragment
  })

  // @ts-ignore
  expect(asFragment()).toMatchSnapshot()
})

test('mermaid', async () => {
  let asFragment

  await act(() => {
    const component = render(
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
    asFragment = component.asFragment
  })

  // @ts-ignore
  expect(asFragment()).toMatchSnapshot()
})

test('blockquote', async () => {
  let asFragment

  await act(() => {
    const component = render(
      <TestRenderer
        article={{
          ...article,
          body: `

And code blocks:

<blockquote>
i am a block
</blockquote>

<blockquote>
multi

line

block
</blockquote>

`,
        }}
      />,
    )
    asFragment = component.asFragment
  })

  // @ts-ignore
  expect(asFragment()).toMatchSnapshot()
})

test('reference fallback', async () => {
  let asFragment

  await act(() => {
    const component = render(
      <TestRenderer
        article={{
          ...article,
          body: `
[hello][hello]

![foobar][foobar]
`,
        }}
      />,
    )
    asFragment = component.asFragment
  })

  // @ts-ignore
  expect(asFragment()).toMatchSnapshot()
})

test('footnote', async () => {
  let asFragment

  await act(() => {
    const component = render(
      <TestRenderer
        article={{
          ...article,
          body: `
Hello[^hello]

[^hello]: i am a footnote
`,
        }}
      />,
    )
    asFragment = component.asFragment
  })

  // @ts-ignore
  expect(asFragment()).toMatchSnapshot()
})

test('multiline footnote', async () => {
  let asFragment

  await act(() => {
    const component = render(
      <TestRenderer
        article={{
          ...article,
          body: `
Hello[^hello]

[^hello]: i am a footnote
here is more
and more

this is outside of the footnote
`,
        }}
      />,
    )
    asFragment = component.asFragment
  })

  // @ts-ignore
  expect(asFragment()).toMatchSnapshot()
})

test('multiline indented footnote', async () => {
  let asFragment

  await act(() => {
    const component = render(
      <TestRenderer
        article={{
          ...article,
          body: `
Hello[^hello]

[^hello]: i am a footnote
    here is more
    **and more**

    \`and more\`

    and more

this is outside of the footnote
`,
        }}
      />,
    )
    asFragment = component.asFragment
  })

  // @ts-ignore
  expect(asFragment()).toMatchSnapshot()
})
