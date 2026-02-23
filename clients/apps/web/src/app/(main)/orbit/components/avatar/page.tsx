import { Avatar, Box, Stack, Text } from '@polar-sh/orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

// ─── Demo data ────────────────────────────────────────────────────────────────

const sizes = [
  { size: 'sm', px: '24px' },
  { size: 'md', px: '32px' },
  { size: 'lg', px: '40px' },
  { size: 'xl', px: '48px' },
] as const

const states = [
  {
    label: 'With image',
    desc: 'Renders the provided src. Fades in once the image has loaded to avoid a flash on cache hits.',
    src: 'https://avatars.githubusercontent.com/u/1753052',
    name: 'birk',
  },
  {
    label: 'Broken image',
    desc: 'When the src returns an error the Facehash fallback renders automatically — no extra handling required.',
    src: 'https://this-image-does-not-exist.example.com/404.png',
    name: 'birk',
  },
  {
    label: 'No image',
    desc: 'Pass null or omit src entirely. Facehash generates a deterministic face from the name.',
    src: null,
    name: 'birk',
  },
]

const facehashExamples = [
  'alice',
  'bob',
  'carol',
  'dave',
  'eve',
  'frank',
  'grace',
  'heidi',
]

const props = [
  {
    name: 'name',
    type: 'string',
    default: '—',
    desc: 'Name of the person. Used as the Facehash seed and the img alt attribute.',
  },
  {
    name: 'src',
    type: 'string | null',
    default: '—',
    desc: 'Avatar image URL. Omit or pass null to always show the Facehash fallback.',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg' | 'xl'",
    default: "'md'",
    desc: 'Size token mapping to 24 / 32 / 40 / 48 px.',
  },
  {
    name: 'className',
    type: 'string',
    default: '—',
    desc: 'Additional classes merged via twMerge. Use sparingly.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AvatarPage() {
  return (
    <Stack vertical gap="spacing-10">
      <OrbitPageHeader
        label="Component"
        title="Avatar"
        description="Displays a user's avatar image with a deterministic Facehash fallback. When the image is missing, broken, or not provided, a unique face is generated from the name — same input always produces the same face, with no API calls or storage required."
      />

      {/* Sizes */}
      <Stack vertical gap="spacing-4">
        <OrbitSectionHeader title="Sizes" />
        <Stack vertical className="dark:divide-polar-800 divide-y divide-neutral-200">
          {sizes.map(({ size, px }) => (
            <Box key={size} className="grid grid-cols-5 items-center gap-8 py-5">
              <Stack vertical className="gap-0.5">
                <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs">
                  {size}
                </Text>
                <Text variant="subtle" fontSize="xs">{px}</Text>
              </Stack>
              <Box className="col-span-4">
                <Avatar name="birk" size={size} />
              </Box>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* States */}
      <Stack vertical gap="spacing-4">
        <OrbitSectionHeader title="States" />
        <Stack vertical className="dark:divide-polar-800 divide-y divide-neutral-200">
          {states.map(({ label, desc, src, name }) => (
            <Box key={label} className="grid grid-cols-5 items-center gap-8 py-6">
              <Stack vertical className="col-span-2 gap-1">
                <Text fontWeight="medium" fontSize="sm">{label}</Text>
                <Text variant="subtle" fontSize="xs">{desc}</Text>
              </Stack>
              <Box className="col-span-3">
                <Avatar name={name} src={src} size="lg" />
              </Box>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* Facehash */}
      <Stack vertical gap="spacing-4">
        <OrbitSectionHeader
          title="Facehash"
          description="Every unique name produces a unique, deterministic face. The same name always renders the same avatar — across sessions, devices, and renders."
        />
        <Stack flexWrap="wrap" gap="spacing-2">
          {facehashExamples.map((name) => (
            <Stack vertical key={name} alignItems="center" gap="spacing-1">
              <Avatar name={name} size="xl" />
              <Text as="span" variant="subtle" fontFamily="mono" fontSize="xs">{name}</Text>
            </Stack>
          ))}
        </Stack>
      </Stack>

      {/* Props */}
      <Stack vertical gap="spacing-3">
        <OrbitSectionHeader title="Props" />
        <Stack vertical className="dark:divide-polar-800 divide-y divide-neutral-200">
          {props.map(({ name, type, default: def, desc }) => (
            <Box key={name} className="grid grid-cols-5 gap-4 py-4">
              <Text as="code" fontFamily="mono" fontSize="sm">
                {name}
              </Text>
              <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs" className="col-span-2">
                {type}
              </Text>
              <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs">
                {def}
              </Text>
              <Text variant="subtle" fontSize="xs">{desc}</Text>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Stack>
  )
}
