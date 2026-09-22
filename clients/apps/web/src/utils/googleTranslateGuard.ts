/**
 * Google Translate rewrites text nodes in place: it detaches the original node and
 * substitutes a <font> wrapper holding the translated string. React keeps a reference
 * to the node it rendered, and react-dom calls `removeChild`/`insertBefore` without
 * checking parentage, so the next update to translated text throws
 * `NotFoundError: The node to be removed is not a child of this node` during commit.
 * That escapes React's error handling and unmounts the tree — a blank page.
 *
 * These guards turn that one failure into a no-op. They deliberately do *not* swallow
 * every parentage error: unless Google Translate is demonstrably responsible for the
 * mismatch, the call falls through to the native method and still throws, so genuine
 * reconciliation bugs stay visible.
 *
 * `Node.prototype` is per-realm, so this only affects the app's own document —
 * third-party iframes (Stripe) run untouched.
 */

type SuppressionReporter = (method: string, node: Node, parent: Node) => void

const FONT_NODE_NAME = 'FONT'
const TRANSLATED_ROOT_CLASSES = ['translated-ltr', 'translated-rtl']

const hasFontChild = (parent: Node): boolean => {
  for (let child = parent.firstChild; child; child = child.nextSibling) {
    if (child.nodeName === FONT_NODE_NAME) {
      return true
    }
  }
  return false
}

const hasFontAncestor = (node: Node): boolean => {
  for (let current = node.parentNode; current; current = current.parentNode) {
    if (current.nodeName === FONT_NODE_NAME) {
      return true
    }
  }
  return false
}

/**
 * Only true when the DOM carries Google Translate's fingerprints: the classes it puts
 * on <html>, or the <font> wrappers it leaves around the nodes involved.
 */
const isTranslationArtifact = (node: Node, expectedParent: Node): boolean => {
  const root = node.ownerDocument?.documentElement
  if (
    root &&
    TRANSLATED_ROOT_CLASSES.some((className) =>
      root.classList.contains(className),
    )
  ) {
    return true
  }
  return hasFontAncestor(node) || hasFontChild(expectedParent)
}

let installed = false

export const installGoogleTranslateGuard = (
  report?: SuppressionReporter,
): void => {
  if (installed || typeof Node === 'undefined') {
    return
  }
  installed = true

  const nativeRemoveChild = Node.prototype.removeChild
  const nativeInsertBefore = Node.prototype.insertBefore

  Node.prototype.removeChild = function removeChild<T extends Node>(
    this: Node,
    child: T,
  ): T {
    if (child.parentNode !== this && isTranslationArtifact(child, this)) {
      report?.('removeChild', child, this)
      return child
    }
    return nativeRemoveChild.call(this, child) as T
  }

  Node.prototype.insertBefore = function insertBefore<T extends Node>(
    this: Node,
    node: T,
    child: Node | null,
  ): T {
    if (
      child &&
      child.parentNode !== this &&
      isTranslationArtifact(child, this)
    ) {
      report?.('insertBefore', child, this)
      return node
    }
    return nativeInsertBefore.call(this, node, child) as T
  }
}

export const resetGoogleTranslateGuardForTests = (): void => {
  installed = false
}
