import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Landing/Chapter'
import { BrandColor, brandColors, brandSections } from './brand'

function isLight(hex: string): boolean {
  const v = parseInt(hex.replace('#', ''), 16)
  const r = (v >> 16) & 255
  const g = (v >> 8) & 255
  const b = v & 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
}

function ColorColumn({ color }: { color: BrandColor }) {
  const light = isLight(color.hex)

  return (
    <div
      className="flex min-h-[40vh] flex-col justify-between p-8 md:min-h-[60vh] md:p-10"
      style={{
        flex: color.flex,
        backgroundColor: color.hex,
        color: light ? '#070708' : '#F5F6FA',
      }}
    >
      <Box justifyContent="between" alignItems="baseline" columnGap="l">
        <Text as="span" color="inherit">
          {color.name}
        </Text>
        <Text as="span" color="inherit">
          <Box as="span" opacity={0.5}>
            {color.role}
          </Box>
        </Text>
      </Box>
      <Box flexDirection="column" rowGap="xs">
        <Text variant="caption" color="inherit" monospace>
          {color.hex}
        </Text>
        <Text variant="caption" color="inherit" monospace wrap="nowrap">
          {color.oklch}
        </Text>
      </Box>
    </div>
  )
}

export function ColorSection() {
  return (
    <Chapter
      id={brandSections[1].id}
      index={brandSections[1].index}
      name={brandSections[1].label}
      title="A monochrome color system"
      subtitle="Night to Snow in a single neutral hue"
      description="Ether is the only accent, reserved for moments that need to carry energy."
    >
      <Box
        width="100%"
        flexDirection={{ base: 'column', md: 'row' }}
        overflow="hidden"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        {brandColors.map((color) => (
          <ColorColumn key={color.name} color={color} />
        ))}
      </Box>
    </Chapter>
  )
}
