import { useCallback } from 'react'
import type {
  GestureResponderEvent,
  TouchableWithoutFeedbackProps,
} from 'react-native'

import * as Haptics from 'expo-haptics'
import {
  TouchableHighlight,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native'

type Feedback = 'none' | 'highlight' | 'opacity'

interface TouchableProps extends TouchableWithoutFeedbackProps {
  children: React.ReactNode
  feedback?: Feedback
  activeOpacity?: number
  isListItem?: boolean
}

export const Touchable = ({
  feedback: _feedback,
  onPress,
  onLongPress: _onLongPress,
  isListItem,
  children,
  activeOpacity,
  style,
  ...props
}: TouchableProps) => {
  const feedback: Feedback = _feedback ?? 'opacity'

  const onLongPress = useCallback(
    (event: GestureResponderEvent) => {
      if (_onLongPress) {
        onLongPress(event)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      }
    },
    [_onLongPress],
  )

  let touchableComponent: React.ReactNode

  if (feedback === 'highlight') {
    touchableComponent = (
      <TouchableHighlight
        onPress={onPress}
        onLongPress={onLongPress}
        delayPressIn={isListItem ? 130 : 0}
        delayPressOut={isListItem ? 130 : 0}
        activeOpacity={activeOpacity}
        style={style}
        {...props}
      >
        {children}
      </TouchableHighlight>
    )
  } else if (feedback === 'opacity') {
    touchableComponent = (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        delayPressIn={isListItem ? 130 : 0}
        delayPressOut={isListItem ? 130 : 0}
        activeOpacity={activeOpacity}
        style={style}
        {...props}
      >
        {children}
      </TouchableOpacity>
    )
  } else if (feedback === 'none') {
    touchableComponent = (
      <TouchableWithoutFeedback
        onPress={onPress}
        onLongPress={onLongPress}
        delayPressIn={isListItem ? 130 : 0}
        delayPressOut={isListItem ? 130 : 0}
        style={style}
        {...props}
      >
        {children}
      </TouchableWithoutFeedback>
    )
  }

  return touchableComponent
}
