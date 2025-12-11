import { useCallback, useRef, useState } from 'react'
import { LayoutChangeEvent, PixelRatio } from 'react-native'

const LARGE_IMAGE_THRESHOLD_PERCENTAGE = 400
const SMALL_IMAGE_THRESHOLD_PERCENTAGE = 90

interface SizeWarning {
  type: 'large' | 'small'
  target: number
  actual: number
}

interface UseImageSizeWarningReturn {
  sizeWarning: SizeWarning | null
  onLayout: (event: LayoutChangeEvent) => void
  onImageLoad: (width: number) => void
}

export const useImageSizeWarning = (): UseImageSizeWarningReturn => {
  const [sizeWarning, setSizeWarning] = useState<SizeWarning | null>(null)

  const containerWidth = useRef(0)
  const sourceWidth = useRef(0)

  const checkForSizeWarning = useCallback(() => {
    if (!containerWidth.current || !sourceWidth.current) {
      return
    }

    const targetWidth = PixelRatio.getPixelSizeForLayoutSize(
      Math.round(containerWidth.current),
    )

    const percentage = Math.round((sourceWidth.current / targetWidth) * 100)

    if (percentage > LARGE_IMAGE_THRESHOLD_PERCENTAGE) {
      setSizeWarning({
        type: 'large',
        target: targetWidth,
        actual: sourceWidth.current,
      })
    } else if (percentage < SMALL_IMAGE_THRESHOLD_PERCENTAGE) {
      setSizeWarning({
        type: 'small',
        target: targetWidth,
        actual: sourceWidth.current,
      })
    } else {
      setSizeWarning(null)
    }
  }, [])

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      containerWidth.current = event.nativeEvent.layout.width
      checkForSizeWarning()
    },
    [checkForSizeWarning],
  )

  const onImageLoad = useCallback(
    (width: number) => {
      sourceWidth.current = width
      checkForSizeWarning()
    },
    [checkForSizeWarning],
  )

  return {
    sizeWarning,
    onLayout,
    onImageLoad,
  }
}
