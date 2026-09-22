import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installGoogleTranslateGuard } from './googleTranslateGuard'

const nativeRemoveChild = Node.prototype.removeChild
const nativeInsertBefore = Node.prototype.insertBefore

const report = vi.fn()

beforeAll(() => {
  installGoogleTranslateGuard(report)
})

afterEach(() => {
  report.mockClear()
  document.documentElement.className = ''
  document.body.replaceChildren()
})

/**
 * Mirrors what Google Translate does to a subtree: every text node is detached and a
 * <font> wrapper carrying the translated string is left in its place. The detached
 * nodes are the ones React still holds references to.
 */
const translateInPlace = (parent: HTMLElement): Text[] => {
  const detached: Text[] = []
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) {
      continue
    }
    const font = document.createElement('font')
    font.textContent = `translated:${node.textContent}`
    nativeInsertBefore.call(parent, font, node)
    nativeRemoveChild.call(parent, node)
    detached.push(node as Text)
  }
  return detached
}

const mountTranslated = (): { parent: HTMLElement; orphan: Text } => {
  const parent = document.createElement('div')
  parent.append('Total due')
  document.body.append(parent)
  const [orphan] = translateInPlace(parent)
  return { parent, orphan }
}

describe('installGoogleTranslateGuard', () => {
  it('reproduces the crash the guard exists for', () => {
    const { parent, orphan } = mountTranslated()

    expect(() => nativeRemoveChild.call(parent, orphan)).toThrow(
      /not a child of this node/i,
    )
  })

  it('suppresses removeChild for a node Google Translate detached', () => {
    const { parent, orphan } = mountTranslated()

    expect(parent.removeChild(orphan)).toBe(orphan)
    expect(report).toHaveBeenCalledWith('removeChild', orphan, parent)
  })

  it('suppresses insertBefore against a reference node Google Translate detached', () => {
    const { parent, orphan } = mountTranslated()
    const inserted = document.createElement('span')

    expect(parent.insertBefore(inserted, orphan)).toBe(inserted)
    expect(report).toHaveBeenCalledWith('insertBefore', orphan, parent)
  })

  it('suppresses when only the <html> translation class is present', () => {
    document.documentElement.classList.add('translated-ltr')
    const parent = document.createElement('div')
    const detached = document.createTextNode('Total due')
    document.body.append(parent)

    expect(parent.removeChild(detached)).toBe(detached)
    expect(report).toHaveBeenCalledOnce()
  })

  it('still throws on a parentage mismatch unrelated to translation', () => {
    const owner = document.createElement('div')
    const stranger = document.createElement('div')
    const child = document.createElement('span')
    owner.append(child)
    document.body.append(owner, stranger)

    expect(() => stranger.removeChild(child)).toThrow(
      /not a child of this node/i,
    )
    expect(report).not.toHaveBeenCalled()
  })

  it('leaves well-formed removeChild and insertBefore untouched', () => {
    const parent = document.createElement('div')
    const first = document.createElement('span')
    const second = document.createElement('span')
    parent.append(first)
    document.body.append(parent)

    expect(parent.insertBefore(second, first)).toBe(second)
    expect(Array.from(parent.childNodes)).toEqual([second, first])

    expect(parent.removeChild(second)).toBe(second)
    expect(Array.from(parent.childNodes)).toEqual([first])
    expect(report).not.toHaveBeenCalled()
  })
})
