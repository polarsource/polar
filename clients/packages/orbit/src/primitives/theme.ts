type Brand<T, K> = T & { _type: K }

type Color = Brand<string, 'color'>
type Dimension = Brand<string, 'dimension'>
type Spacing = Brand<string, 'spacing'>
type Radius = Brand<string, 'radius'>
type FontSize = Brand<string, 'fontSize'>
type FontWeight = Brand<
  '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900',
  'fontWeight'
>
type Scalar = Brand<number, 'scalar'>

interface Theme {
  colors: Record<string, Color>
  dimensions: Record<string, Dimension>
  spacing: Record<string, Spacing>
  radius: Record<string, Radius>
  fontSizes: Record<string, FontSize>
  fontWeight: Record<string, FontWeight>
}

const color = (value: string) => value as Color
const dimension = (value: string) => value as Dimension
const spacing = (value: string) => value as Spacing
const radius = (value: string) => value as Radius
const fontSize = (value: string) => value as FontSize
const fontWeight = (value: string) => value as FontWeight
const scalar = (value: number) => value as Scalar

export const theme = {
  colors: {},
  dimensions: {},
  spacing: {},
  radius: {},
} as const satisfies Theme
