import { Avatar, Stack, Text } from '@polar-sh/orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

// ─── Demo data ────────────────────────────────────────────────────────────────

const states = [
  {
    label: 'With image',
    desc: 'Renders the provided avatar_url. Fades in once the image has loaded to avoid a flash on cache hits.',
    avatar_url: 'https://avatars.githubusercontent.com/u/1753052',
    name: 'Birk Jernström',
  },
  {
    label: 'Broken image',
    desc: 'When avatar_url returns an error the initials fallback renders automatically — no extra handling required.',
    avatar_url: 'https://this-image-does-not-exist.example.com/404.png',
    name: 'Birk Jernström',
  },
  {
    label: 'No image',
    desc: 'Pass null for avatar_url. Initials are derived from the name.',
    avatar_url: null,
    name: 'Birk Jernström',
  },
]

const initialsExamples = [
  { name: 'Alice Johnson', avatar_url: null },
  { name: 'Bob Smith', avatar_url: null },
  { name: 'Carol White', avatar_url: null },
  { name: 'Dave Brown', avatar_url: null },
  { name: 'Eve Davis', avatar_url: null },
  { name: 'frank@example.com', avatar_url: null },
  { name: 'Grace Lee', avatar_url: null },
  { name: 'Heidi Martinez', avatar_url: null },
]

const props = [
  {
    name: 'name',
    type: 'string',
    default: '—',
    desc: 'Full name or email. Used as the initials seed and the img alt attribute.',
  },
  {
    name: 'avatar_url',
    type: 'string | null',
    default: '—',
    desc: 'Avatar image URL. Pass null to always show the initials fallback.',
  },
  {
    name: 'className',
    type: 'string',
    default: '—',
    desc: 'Additional classes merged via twMerge. Use sparingly.',
  },
  {
    name: 'height',
    type: 'number',
    default: '—',
    desc: 'Explicit pixel height passed to the underlying image element.',
  },
  {
    name: 'width',
    type: 'number',
    default: '—',
    desc: 'Explicit pixel width passed to the underlying image element.',
  },
  {
    name: 'loading',
    type: "'eager' | 'lazy'",
    default: "'eager'",
    desc: 'Native loading attribute on the image element.',
  },
  {
    name: 'CustomImageComponent',
    type: 'ComponentType<any>',
    default: '—',
    desc: 'Swap in next/image or any other image component. Receives the same props as <img>.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AvatarPage() {
  return (
    <Stack vertical gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Avatar"
        description="Displays a user's avatar image with an initials fallback. When the image is missing, broken, or null, initials are derived from the name. Supports custom image components such as next/image."
      />

      {/* States */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="States" />
        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {states.map(({ label, desc, avatar_url, name }) => (
            <div
              key={label}
              className="grid grid-cols-5 items-center gap-8 py-6"
            >
              <Stack vertical className="col-span-2 gap-1">
                <Text variant="label">{label}</Text>
                <Text variant="caption">{desc}</Text>
              </Stack>
              <div className="col-span-3">
                <Avatar name={name} avatar_url={avatar_url} className="h-8 w-8 text-xs" />
              </div>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* Initials */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="Initials fallback"
          description="Initials are derived from the first and last word of the name. Email addresses are supported — the domain is stripped first. The component remounts on avatar_url change to avoid stale opacity state."
        />
        <Stack flexWrap="wrap" gap={4}>
          {initialsExamples.map(({ name, avatar_url }) => (
            <Stack vertical key={name} alignItems="center" gap={1}>
              <Avatar name={name} avatar_url={avatar_url} className="h-8 w-8 text-xs" />
              <Text as="span" variant="mono">
                {name.split('@')[0].split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </Stack>
          ))}
        </Stack>
      </Stack>

      {/* Props */}
      <Stack vertical gap={3}>
        <OrbitSectionHeader title="Props" />
        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {props.map(({ name, type, default: def, desc }) => (
            <div key={name} className="grid grid-cols-5 gap-4 py-4">
              <Text as="code" variant="mono">
                {name}
              </Text>
              <Text as="code" variant="mono" className="col-span-2">
                {type}
              </Text>
              <Text as="code" variant="mono">
                {def}
              </Text>
              <Text variant="caption">{desc}</Text>
            </div>
          ))}
        </Stack>
      </Stack>
    </Stack>
  )
}
