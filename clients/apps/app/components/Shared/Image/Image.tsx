import { Box } from '@/components/Shared/Box'
import { Image as ExpoImage, ImageLoadEventData, ImageProps } from 'expo-image'
import { LayoutChangeEvent, StyleSheet } from 'react-native'
import { Text } from '../Text'
import { useImageSizeWarning } from './hooks/useImageSizeWarning'

export const Image = ({ onLoad, onLayout, style, ...props }: ImageProps) => {
  const {
    sizeWarning,
    onLayout: onSizeWarningLayout,
    onImageLoad,
  } = useImageSizeWarning()

  const handleLoad = (event: ImageLoadEventData) => {
    onImageLoad(event.source.width)
    onLoad?.(event)
  }

  const handleLayout = (event: LayoutChangeEvent) => {
    onSizeWarningLayout(event)
    onLayout?.(event)
  }

  // Adding this little breadcrump below to make it easier to find and disable this warning
  // Too large, too small

  const showWarning = __DEV__ && sizeWarning

  return (
    <>
      <ExpoImage
        {...props}
        style={style}
        onLayout={handleLayout}
        onLoad={handleLoad}
      />
      {showWarning ? (
        <Box
          position="absolute"
          backgroundColor="error"
          justifyContent="center"
          alignItems="center"
          opacity={0.8}
          style={{
            ...StyleSheet.absoluteFillObject,
            zIndex: 999999,
          }}
        >
          <Text textAlign="center" style={{ fontSize: 9, lineHeight: 10 }}>
            Image is{' '}
            {sizeWarning.type === 'large'
              ? `${Math.round((sizeWarning.actual / sizeWarning.target) * 100) - 100}% too large`
              : `${100 - Math.round((sizeWarning.actual / sizeWarning.target) * 100)}% too small`}
          </Text>
        </Box>
      ) : null}
    </>
  )
}

export type { ImageProps }
