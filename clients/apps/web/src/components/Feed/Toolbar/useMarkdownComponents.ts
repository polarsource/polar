import { useCallback, useContext } from 'react'
import { PostEditorContext } from '../PostEditor'

export const useMarkdownComponents = () => {
  const { ref, insertTextAtCursor, wrapSelectionWithText } =
    useContext(PostEditorContext)

  const insertPaywall = useCallback(() => {
    if (ref.current) {
      ref.current.selectionStart !== ref.current.selectionEnd
        ? wrapSelectionWithText(['<paywall>', '</paywall>'])
        : insertTextAtCursor('<paywall></paywall>')
    }
  }, [wrapSelectionWithText])

  const insertSubscribeNow = useCallback(() => {
    if (ref.current) {
      insertTextAtCursor('<SubscribeNow />')
    }
  }, [wrapSelectionWithText])

  return {
    insertPaywall,
    insertSubscribeNow,
  }
}
