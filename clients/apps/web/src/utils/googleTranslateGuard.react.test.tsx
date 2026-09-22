import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { installGoogleTranslateGuard } from './googleTranslateGuard'

const nativeRemoveChild = Node.prototype.removeChild
const nativeInsertBefore = Node.prototype.insertBefore

/** Conditional text beside an element — the shape this app renders in hundreds of places. */
const Panel = ({ show }: { show: boolean }) => (
  <div>
    {show && 'Payment succeeded'}
    <span>detail</span>
  </div>
)

const googleTranslate = (root: HTMLElement): void => {
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const font = document.createElement('font')
      font.textContent = `traduit:${node.textContent}`
      nativeInsertBefore.call(root, font, node)
      nativeRemoveChild.call(root, node)
    } else {
      googleTranslate(node as HTMLElement)
    }
  }
}

beforeAll(() => {
  installGoogleTranslateGuard()
})

describe('React rendering under Google Translate', () => {
  it('unmounts translated text without tearing down the tree', () => {
    const { container, rerender } = render(<Panel show />)
    googleTranslate(container)

    expect(() => rerender(<Panel show={false} />)).not.toThrow()
    expect(container.querySelector('span')?.textContent).toContain('detail')
  })
})
