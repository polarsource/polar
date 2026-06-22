import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import type {
  BackgroundColorToken,
  TextColorToken,
  BorderColorToken,
} from '@polar-sh/orbit/theme'

export const BACKGROUND_TOKENS: {
  token: BackgroundColorToken
  note: string
}[] = [
  { token: 'background-primary', note: 'Page background' },
  { token: 'background-secondary', note: 'Sectioned / raised surface' },
  { token: 'background-card', note: 'Card / inset panel surface' },
  { token: 'background-inverse', note: 'Inverted, high-contrast surface' },
  { token: 'background-warning', note: 'Warning surface' },
  { token: 'background-success', note: 'Success surface' },
  { token: 'background-danger', note: 'Danger surface' },
]

export const TEXT_TOKENS: { token: TextColorToken; note: string }[] = [
  { token: 'text-primary', note: 'Primary copy' },
  { token: 'text-secondary', note: 'De-emphasised copy' },
  { token: 'text-tertiary', note: 'Hints, captions, placeholders' },
  { token: 'text-success', note: 'Success text' },
  { token: 'text-danger', note: 'Danger text' },
  { token: 'text-warning', note: 'Warning text' },
]

export const BORDER_TOKENS: { token: BorderColorToken; note: string }[] = [
  { token: 'border-primary', note: 'Default borders & dividers' },
  { token: 'border-secondary', note: 'Subtle / secondary dividers' },
  { token: 'border-warning', note: 'Warning borders' },
]

function SwatchFrame({
  children,
  token,
  note,
}: {
  children: React.ReactNode
  token: string
  note: string
}) {
  return (
    <Box flexDirection="column" rowGap="s">
      {children}
      <Box flexDirection="column" rowGap="xs">
        <Text monospace color="inherit">
          {token}
        </Text>
        <Text variant="caption" color="default">
          {note}
        </Text>
      </Box>
    </Box>
  )
}

export function BackgroundSwatch({
  token,
  note,
}: {
  token: BackgroundColorToken
  note: string
}) {
  return (
    <SwatchFrame token={token} note={note}>
      <Box
        width="100%"
        height={64}
        borderRadius="m"
        backgroundColor={token}
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      />
    </SwatchFrame>
  )
}

export function TextSwatch({
  token,
  note,
}: {
  token: TextColorToken
  note: string
}) {
  return (
    <SwatchFrame token={token} note={note}>
      <Box
        height={64}
        alignItems="center"
        paddingHorizontal="l"
        borderRadius="m"
        backgroundColor="background-secondary"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        color={token}
      >
        <Text variant="heading-xxs" as="span" color="inherit">
          Ag
        </Text>
      </Box>
    </SwatchFrame>
  )
}

export function BorderSwatch({
  token,
  note,
}: {
  token: BorderColorToken
  note: string
}) {
  return (
    <SwatchFrame token={token} note={note}>
      <Box
        width="100%"
        height={64}
        borderRadius="m"
        backgroundColor="background-secondary"
        borderWidth={1}
        borderStyle="solid"
        borderColor={token}
      />
    </SwatchFrame>
  )
}
