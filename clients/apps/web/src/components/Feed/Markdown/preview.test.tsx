import { article } from '@/utils/testdata'
import { Article } from '@polar-sh/sdk'
import '@testing-library/jest-dom'
import ReactDOMServer from 'react-dom/server'
import PreviewText, { UnescapeText } from './preview'

const TestRenderer = (article: Article) => {
  const preview = UnescapeText(
    ReactDOMServer.renderToStaticMarkup(<PreviewText article={article} />),
  )
  return preview
}

test('entities', () => {
  const a = {
    ...article,
    body: `
**This** is a test & "preview"

<img src="https://framerusercontent.com/images/O7exOgMXifmEOmoFdmbAVNBk6Y.png">
`,
  }
  expect(TestRenderer(a)).toEqual('This is a test & "preview"')
})
