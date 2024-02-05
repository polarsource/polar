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

  const insertAd = useCallback(
    (id: string) => {
      if (bodyRef.current) {
        insertTextAtCursor(`<Ad subscriptionBenefitId="${id}" />`)
      }
    },
    [insertTextAtCursor],
  )

  const insertYouTube = useCallback(
    (url: string) => {
      const id = youtubeIdFromURL(url)
      if (!id) {
        return
      }

      if (!bodyRef.current) {
        return
      }

      insertTextAtCursor(
        `<iframe src="https://www.youtube.com/embed/${id}"></iframe>`,
      )
    },
    [insertTextAtCursor],
  )

  return {
    insertPaywall,
    insertSubscribeNow,
    insertAd,
    insertYouTube,
  }
}

const youtubeUrlRe =
  /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|live\/|v\/)?)([\w\-]+)(\S+)?$/

export const youtubeIdFromURL = (url: string): string | null => {
  const res = url.match(youtubeUrlRe)
  if (res && res.length >= 7) {
    return res[6]
  }
  return null
}
