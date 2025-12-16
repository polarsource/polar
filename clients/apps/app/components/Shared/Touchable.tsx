/* eslint-disable @polar/no-touchable */
import { Theme } from '@/design-system/theme'
import { BoxProps } from '@shopify/restyle'
import * as Haptics from 'expo-haptics'
import { useCallback } from 'react'
import type {
  GestureResponderEvent,
  TouchableWithoutFeedbackProps,
} from 'react-native'
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
  boxProps?: BoxProps<Theme>
}

export const Touchable = ({
  feedback = 'opacity',
  onPress,
  onLongPress: _onLongPress,
  isListItem,
  children,
  activeOpacity = 0.6,
  boxProps,
  style,
  ...props
}: TouchableProps) => {
  const onLongPress = useCallback(
    (event: GestureResponderEvent) => {
      if (_onLongPress) {
        _onLongPress(event)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      }
    },
    [_onLongPress],
  )

  if (feedback === 'highlight') {
    return (
      <TouchableHighlight
        activeOpacity={activeOpacity}
        onPress={onPress}
        onLongPress={onLongPress}
        delayPressIn={isListItem ? 130 : 0}
        delayPressOut={isListItem ? 130 : 0}
        style={style}
        {...props}
      >
        {children}
      </TouchableHighlight>
    )
  }

  if (feedback === 'opacity') {
    return (
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPress={onPress}
        onLongPress={onLongPress}
        delayPressIn={isListItem ? 130 : 0}
        delayPressOut={isListItem ? 130 : 0}
        style={style}
        {...props}
      >
        {children}
      </TouchableOpacity>
    )
  }

  return (
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
