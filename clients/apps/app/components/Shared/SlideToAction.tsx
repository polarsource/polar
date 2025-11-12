import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleProp,
  ViewStyle,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/hooks/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface SlideToActionProps {
  onSlideComplete: () => void;
  text?: string;
  releaseText?: string;
  style?: StyleProp<ViewStyle>;
  isLoading?: boolean;
  disabled?: boolean;
  onSlideStart?: () => void;
  onSlideEnd?: () => void;
}

export const SlideToAction = ({
  onSlideComplete,
  text = "Slide to confirm",
  releaseText = "Release To Confirm",
  style,
  disabled = false,
  isLoading = false,
  onSlideStart,
  onSlideEnd,
}: SlideToActionProps) => {
  const { colors } = useTheme();

  const [label, setLabel] = useState(text);
  const [sliderWidth, setSliderWidth] = useState(0);
  const [thumbWidth, setThumbWidth] = useState(0);
  const slideAnimation = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const maxSlide = useMemo(() => {
    return Math.max(0, sliderWidth - thumbWidth - 16);
  }, [sliderWidth, thumbWidth]);

  const handleLayoutSlider = useCallback((event: any) => {
    setSliderWidth(event.nativeEvent.layout.width);
  }, []);

  const handleLayoutThumb = useCallback((event: any) => {
    setThumbWidth(event.nativeEvent.layout.width);
  }, []);

  const resetPosition = useCallback(() => {
    Animated.spring(slideAnimation, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [slideAnimation]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderMove: (event, gestureState) => {
          const newPosition = Math.max(0, Math.min(gestureState.dx, maxSlide));
          slideAnimation.setValue({ x: newPosition, y: 0 });
        },
        onPanResponderStart: (e) => {
          onSlideStart?.();
        },
        onPanResponderEnd: (e) => {
          onSlideEnd?.();
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx >= maxSlide * 0.9) {
            Animated.spring(slideAnimation, {
              toValue: maxSlide,
              useNativeDriver: true,
            }).start(() => {
              onSlideComplete();
              resetPosition();
            });
          } else {
            resetPosition();
          }
        },
      }),
    [disabled, maxSlide, resetPosition, onSlideComplete]
  );

  const interpolatedBackgroundColor = slideAnimation.x.interpolate({
    inputRange: [0, maxSlide],
    outputRange: [colors.card, colors.monochromeInverted],
    extrapolate: "clamp",
  });

  const interpolatedThumbBackgroundColor = slideAnimation.x.interpolate({
    inputRange: [0, maxSlide],
    outputRange: [colors.secondary, colors.primary],
    extrapolate: "clamp",
  });

  const interpolatedTextColor = slideAnimation.x.interpolate({
    inputRange: [0, maxSlide],
    outputRange: [colors.monochromeInverted, colors.monochrome],
    extrapolate: "clamp",
  });

  useEffect(() => {
    const listener = slideAnimation.addListener(({ x }) => {
      if (x >= maxSlide) {
        setLabel(releaseText);
      } else {
        setLabel(text);
      }
    });

    return () => slideAnimation.removeListener(listener);
  }, [slideAnimation, maxSlide, text, releaseText]);

  return (
    <Animated.View
      style={[
        SlideToActionStyles.container,
        {
          backgroundColor: interpolatedBackgroundColor,
        },
        disabled && {
          opacity: 0.5,
        },
        style,
      ]}
      onLayout={handleLayoutSlider}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.monochromeInverted} />
      ) : (
        <Animated.Text
          style={[SlideToActionStyles.label, { color: interpolatedTextColor }]}
        >
          {label}
        </Animated.Text>
      )}
      <Animated.View
        style={[
          SlideToActionStyles.thumb,
          {
            transform: [{ translateX: slideAnimation.x }],
            backgroundColor: interpolatedThumbBackgroundColor,
          },
        ]}
        onLayout={handleLayoutThumb}
        {...panResponder.panHandlers}
      >
        <MaterialIcons
          name="arrow-forward-ios"
          size={16}
          color={colors.monochromeInverted}
        />
      </Animated.View>
    </Animated.View>
  );
};

const SlideToActionStyles = StyleSheet.create({
  container: {
    height: 80,
    width: "100%",
    borderRadius: 9999,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    position: "absolute",
    height: 64,
    width: 64,
    left: 8,
    top: 8,
    borderRadius: 9999,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 16,
  },
});
