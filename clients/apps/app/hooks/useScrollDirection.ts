import { SharedValue, useSharedValue } from 'react-native-reanimated'
import { ReanimatedScrollEvent } from 'react-native-reanimated/lib/typescript/hook/commonTypes'

export type ScrollDirection = 'to-top' | 'to-bottom' | 'idle'
export type ScrollDirectionValue = SharedValue<ScrollDirection>

export const useScrollDirection = (param?: 'include-negative') => {
  const scrollDirection = useSharedValue<ScrollDirection>('idle')
  const prevOffsetY = useSharedValue(0)
  const offsetYAnchorOnBeginDrag = useSharedValue(0)
  const offsetYAnchorOnChangeDirection = useSharedValue(0)

  const onBeginDrag = (e: ReanimatedScrollEvent | number) => {
    'worklet'
    const offsetY = typeof e === 'number' ? e : e.contentOffset.y
    offsetYAnchorOnBeginDrag.set(offsetY)
  }

  const onScroll = (e: ReanimatedScrollEvent | number) => {
    'worklet'

    const offsetY = typeof e === 'number' ? e : e.contentOffset.y

    const positiveOffsetY =
      param === 'include-negative' ? offsetY : Math.max(offsetY, 0)
    const positivePrevOffsetY =
      param === 'include-negative'
        ? prevOffsetY.get()
        : Math.max(prevOffsetY.get(), 0)

    if (
      positivePrevOffsetY - positiveOffsetY < 0 &&
      (scrollDirection.get() === 'idle' || scrollDirection.get() === 'to-top')
    ) {
      scrollDirection.set('to-bottom')
      offsetYAnchorOnChangeDirection.set(offsetY)
    }

    if (
      positivePrevOffsetY - positiveOffsetY > 0 &&
      (scrollDirection.get() === 'idle' ||
        scrollDirection.get() === 'to-bottom')
    ) {
      scrollDirection.set('to-top')
      offsetYAnchorOnChangeDirection.set(offsetY)
    }

    prevOffsetY.set(offsetY)
  }

  return {
    scrollDirection,
    offsetYAnchorOnBeginDrag,
    offsetYAnchorOnChangeDirection,
    onBeginDrag,
    onScroll,
  }
}
