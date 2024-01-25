import { useCallback, useContext } from 'react'
import { PostEditorContext } from '../PostEditor'

export const useMarkdownComponents = () => {
  const { bodyRef, insertTextAtCursor, wrapSelectionWithText } =
    useContext(PostEditorContext)

  const insertPaywall = useCallback(() => {
    if (bodyRef.current) {
      bodyRef.current.selectionStart !== bodyRef.current.selectionEnd
        ? wrapSelectionWithText(['<Paywall>', '</Paywall>'])
        : insertTextAtCursor('<Paywall></Paywall>')
    }
  }, [wrapSelectionWithText, insertTextAtCursor])

  const insertSubscribeNow = useCallback(() => {
    if (bodyRef.current) {
      insertTextAtCursor('<SubscribeNow />')
    }
  }, [wrapSelectionWithText])

  const insertAd = useCallback(() => {
    if (bodyRef.current) {
      insertTextAtCursor('<Ad subscriptionBenefitId="ADD_BENEFIT_ID_HERE" />')
    }
  }, [insertTextAtCursor])

  return {
    insertPaywall,
    insertSubscribeNow,
    insertAd,
  }
}
