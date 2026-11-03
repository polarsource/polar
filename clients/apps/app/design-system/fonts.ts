import { StyleProp, StyleSheet, TextStyle } from 'react-native'

export const fontAssets = {
  'PPNeueMontreal-Regular': require('@/assets/fonts/PPNeueMontreal-Regular.ttf'),
  'PPNeueMontreal-Medium': require('@/assets/fonts/PPNeueMontreal-Medium.ttf'),
  'PPNeueMontreal-SemiBold': require('@/assets/fonts/PPNeueMontreal-Semibold.ttf'),
  'PPNeueMontreal-Bold': require('@/assets/fonts/PPNeueMontreal-Bold.ttf'),
}

type FontFamily = keyof typeof fontAssets

// Matches the web app's `letter-spacing: 0.015em`
const LETTER_SPACING_EM = 0.015

const fontFamilyForWeight = (
  weight: TextStyle['fontWeight'] | undefined,
): FontFamily => {
  switch (String(weight)) {
    case '500':
      return 'PPNeueMontreal-Medium'
    case '600':
      return 'PPNeueMontreal-SemiBold'
    case '700':
    case '800':
    case '900':
    case 'bold':
      return 'PPNeueMontreal-Bold'
    default:
      return 'PPNeueMontreal-Regular'
  }
}

// Each weight is registered as its own family, so the weight is expressed
// through the family and fontWeight is reset to avoid synthesized bolding.
export const resolveFontStyle = (
  style: StyleProp<TextStyle>,
  fallback: Pick<TextStyle, 'fontWeight' | 'fontSize'>,
): TextStyle => {
  const flat = StyleSheet.flatten(style) ?? {}
  const fontSize = flat.fontSize ?? fallback.fontSize ?? 16

  return {
    fontFamily: fontFamilyForWeight(flat.fontWeight ?? fallback.fontWeight),
    fontWeight: 'normal',
    letterSpacing: flat.letterSpacing ?? fontSize * LETTER_SPACING_EM,
  }
}
