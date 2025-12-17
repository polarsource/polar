import { useHomeHeaderHeight } from '@/hooks/useHomeHeaderHeight'
import { ScrollDirection, useScrollDirection } from '@/hooks/useScrollDirection'
import {
  createContext,
  FC,
  PropsWithChildren,
  RefObject,
  useContext,
  useRef,
} from 'react'
import Animated, {
  DerivedValue,
  ScrollHandlerProcessed,
  SharedValue,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

type AnimatedScrollView = Animated.ScrollView

type ContextValue = {
  headerTop: SharedValue<number>
  isHeaderVisible: DerivedValue<boolean>
  scrollViewRef: RefObject<AnimatedScrollView | null>
  listPointerEvents: SharedValue<boolean>
  offsetY: SharedValue<number>
  velocityOnEndDrag: SharedValue<number>
  scrollHandler: ScrollHandlerProcessed<Record<string, unknown>>
  scrollDirection: SharedValue<ScrollDirection>
  offsetYAnchorOnBeginDrag: SharedValue<number>
}

const AnimatedScrollContext = createContext<ContextValue>({} as ContextValue)

export const AnimatedScrollProvider: FC<PropsWithChildren> = ({ children }) => {
  const { netHeaderHeight } = useHomeHeaderHeight()

  const scrollViewRef = useRef<AnimatedScrollView | null>(null)
  const listPointerEvents = useSharedValue(true)

  const headerTop = useSharedValue(0)
  const isHeaderVisible = useDerivedValue(
    () =>
      Math.abs(headerTop.get()) >= 0 &&
      Math.abs(headerTop.get()) < netHeaderHeight,
  )

  const offsetY = useSharedValue(0)
  const velocityOnEndDrag = useSharedValue(0)

  const handleScrollEndDrag = (offsetYValue: number) => {
    scrollViewRef.current?.scrollTo({
      y: offsetYValue,
      animated: true,
    })
    setTimeout(() => {
      listPointerEvents.set(true)
    }, 300)
  }

  const {
    onBeginDrag: directionOnBeginDrag,
    onScroll: directionOnScroll,
    scrollDirection,
    offsetYAnchorOnBeginDrag,
  } = useScrollDirection()

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: (event) => {
      velocityOnEndDrag.set(0)
      directionOnBeginDrag(event)
    },
    onScroll: (event) => {
      const offsetYValue = event.contentOffset.y
      offsetY.set(offsetYValue)
      directionOnScroll(event)
    },
    onEndDrag: (event) => {
      velocityOnEndDrag.set(event.velocity?.y ?? 0)

      const headerTopTriggerDistance =
        Math.abs(headerTop.get()) >= 2 &&
        Math.abs(headerTop.get()) < netHeaderHeight - 2

      if (scrollDirection.get() === 'to-bottom' && headerTopTriggerDistance) {
        const targetScrollOffset =
          event.contentOffset.y +
          (netHeaderHeight - Math.abs(headerTop.get()) + 2)
        listPointerEvents.set(false)
        scheduleOnRN(handleScrollEndDrag, targetScrollOffset)
      }

      if (scrollDirection.get() === 'to-top' && headerTopTriggerDistance) {
        const targetScrollOffset = event.contentOffset.y - netHeaderHeight - 2
        listPointerEvents.set(false)
        scheduleOnRN(handleScrollEndDrag, targetScrollOffset)
      }
    },
  })

  const value: ContextValue = {
    headerTop,
    isHeaderVisible,
    scrollViewRef,
    listPointerEvents,
    offsetY,
    velocityOnEndDrag,
    scrollHandler,
    scrollDirection,
    offsetYAnchorOnBeginDrag,
  }

  return (
    <AnimatedScrollContext.Provider value={value}>
      {children}
    </AnimatedScrollContext.Provider>
  )
}

export const useAnimatedScroll = () => {
  const context = useContext(AnimatedScrollContext)

  if (!context) {
    throw new Error(
      'useAnimatedScroll must be used within an AnimatedScrollProvider',
    )
  }

  return context
}
