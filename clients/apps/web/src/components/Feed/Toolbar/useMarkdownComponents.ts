import { useCallback, useContext } from 'react'
import { PostEditorContext } from '../PostEditor'

export const useMarkdownComponents = () => {
  const { ref, insertTextAtCursor, wrapSelectionWithText } =
    useContext(PostEditorContext)

  const insertPaywall = useCallback(() => {
    if (ref.current) {
      ref.current.selectionStart !== ref.current.selectionEnd
        ? wrapSelectionWithText(['<Paywall>', '</Paywall>'])
        : insertTextAtCursor('<Paywall></Paywall>')
    }
  }, [wrapSelectionWithText, insertTextAtCursor])

  const insertSubscribeNow = useCallback(() => {
    if (ref.current) {
      insertTextAtCursor('<SubscribeNow />')
    }
  }, [wrapSelectionWithText])

  const insertAd = useCallback(() => {
    if (ref.current) {
      insertTextAtCursor('<Ad subscriptionBenefitId="ADD_BENEFIT_ID_HERE" />')
    }
  }, [insertTextAtCursor])

  return {
    insertPaywall,
    insertSubscribeNow,
    insertAd,
  }
}
