import { firstChild, hasContent } from './markdown'

describe('hasContent', () => {
  test('empty', () => {
    expect(hasContent(<></>)).toBe(false)
  })

  test('empty nested', () => {
    expect(
      hasContent(
        <>
          <></>
          <>
            <></>
          </>
        </>,
      ),
    ).toBe(false)
  })

  test('top', () => {
    expect(hasContent(<span>text</span>)).toBe(true)
  })

  test('content under fragment', () => {
    expect(
      hasContent(
        <>
          <span>text</span>
        </>,
      ),
    ).toBe(true)
  })
})

describe('firstChild', () => {
  test('empty', () => {
    expect(firstChild(<></>)).toMatchSnapshot()
  })

  test('empty nested', () => {
    expect(
      firstChild(
        <>
          <></>
          <>
            <></>
          </>
        </>,
      ),
    ).toMatchSnapshot()
  })

  test('top', () => {
    expect(firstChild(<span>text</span>)).toMatchSnapshot()
  })

  test('content under fragment', () => {
    expect(
      firstChild(
        <>
          <span>text</span>
        </>,
      ),
    ).toMatchSnapshot()
  })

  test('sibling content', () => {
    expect(
      firstChild(
        <>
          <span>t1</span>
          <span>t2</span>
          <span>t3</span>
        </>,
      ),
    ).toMatchSnapshot()
  })

  test('different nesting', () => {
    expect(
      firstChild(
        <>
          <>
            <span>t1</span>
            <span>t2</span>
          </>
          <span>t3</span>
        </>,
      ),
    ).toMatchSnapshot()
  })
})
