import { article } from 'polarkit/testdata'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import Markdown from '@zegl/markdown-to-jsx'
import Paywall from './Paywall/Paywall'
import {
  RenderArticle,
  markdownOpts,
  wrapStrictCreateElement,
} from './markdown'
import { polarPost } from './testdata/polarPost'

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

test('basic', () => {
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

This is a normal **block** of text [Polar](https://polar.sh/) with _various_ formatting.
And here it continues in the same block.

This is a different block.  
With a linebreak! (double whitespace)

> This is a quoute!
  `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('double-whitespace', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: 'Normal **block** example\n\nWith-doublespace  \nWith-doublespace',
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

test('ads-embed', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `
        
<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"><picture><img src="https://polar.sh/embed/ad?id=63f3a3cc-54ae-45e9-987a-7174364d234e" alt="Click me!!!!!" height="100" width="100" /></picture></a>
<a href="https://polar.sh/zegl"><picture><source media="(prefers-color-scheme: dark)" srcset="https://polar.sh/embed/ad?id=94c1676c-db08-4489-b4b4-e25beadf2542&dark=1"><img src="https://polar.sh/embed/ad?id=94c1676c-db08-4489-b4b4-e25beadf2542" alt="Hello world!" height="100" width="100" /></picture></a>

        `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('anchors', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `

<p id="top">
[Go to end](#end)
Here we go!
</p>


## End

<a href="#top">Go to top</a>
  
  `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('XSS', () => {
  const { container } = render(
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
  expect(container).toMatchSnapshot()
})

test('table', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `

| left  | center | right |
| ----- |:------:|----:|
| a | b | c |
| a | b | c |
| a | b | c |


<table>
    <thead>
        <tr><th>TH</th></tr>
    </thead>
    <tbody>
      <tr><td>TD</td></tr>
      <tr><td>TD</td></tr>
      <tr><td>TD</td></tr>
      <tr><td>TD</td></tr>
    </tbody>
</table>
        
  `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('paywall', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `

prepaywall

<Paywall>here is the content! <strong>wow!</strong></Paywall>

<Paywall>plain content</Paywall>

<Paywall><img src="https://polar.sh/logo.png" /></Paywall>

<!-- Empty paywall contents! Should trigger upsell block! -->
<Paywall></Paywall>

postpaywall
  `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

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

test('blockquote', () => {
  const { container } = render(
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
  expect(container).toMatchSnapshot()
})

test('footnote', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `
Here's a simple footnote,[^1] and here's another one[^ref-abc].

[^1]: This is the **first** footnote.
[^ref-abc]: This is \`another\` note!

`,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('references', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `
In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends
of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to
eat: it was a [hobbit-hole][1], and that means comfort.

[1]: <https://en.wikipedia.org/wiki/Hobbit#Lifestyle> "Hobbit lifestyles"
`,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('link-brackets-code', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `E.g [\`[pyclass]\`](https://pyo3.rs/v0.20.3/class#defining-a-new-class).`,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('link-brackets', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `WOW! [[wow]](https://polar.sh) :-)`,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})
