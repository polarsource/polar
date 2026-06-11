import { Avatar } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import type { PropRow } from '@/components/docs'
import { Example, PageHeader, PropsTable, Section } from '@/components/docs'

const imageUrl = 'https://avatars.githubusercontent.com/u/1?v=4'

const imageCode = `<Avatar name="Mona Lisa" avatar_url="https://avatars.githubusercontent.com/u/1?v=4" />`

const initialsCode = `<Avatar name="Ada Lovelace" avatar_url={null} />
<Avatar name="Grace Hopper" avatar_url={null} />`

const sizesCode = `<Avatar name="Mona Lisa" avatar_url={url} height={24} width={24} />
<Avatar name="Mona Lisa" avatar_url={url} height={40} width={40} className="h-10 w-10" />
<Avatar name="Mona Lisa" avatar_url={url} height={64} width={64} className="h-16 w-16" />`

const avatarProps: PropRow[] = [
  {
    name: 'name',
    type: 'string',
    required: true,
    description:
      'Used for the alt text and to derive initials when no image is shown.',
  },
  {
    name: 'avatar_url',
    type: 'string | null',
    required: true,
    description:
      'Image source. Pass null to render the initials fallback. A failed load also falls back to initials.',
  },
  {
    name: 'height',
    type: 'number',
    description: 'Intrinsic image height passed to the underlying image.',
  },
  {
    name: 'width',
    type: 'number',
    description: 'Intrinsic image width passed to the underlying image.',
  },
  {
    name: 'loading',
    type: "'eager' | 'lazy'",
    default: "'eager'",
    description: 'Native image loading attribute.',
  },
  {
    name: 'CustomImageComponent',
    type: 'ElementType',
    description:
      'Optional replacement for the img element, for example a framework Image component.',
  },
  {
    name: 'className',
    type: 'string',
    description:
      'Classes merged onto the avatar container. Use to set the rendered size.',
  },
]

export default function AvatarPage() {
  return (
    <>
      <PageHeader
        title="Avatar"
        description="A circular user image that falls back to initials when no image is provided or the image fails to load."
      />

      <Section
        title="With image"
        description="Provide an avatar_url to render the image. The image fades in once loaded to avoid a flash of fallback text."
      >
        <Example code={imageCode}>
          <Avatar name="Mona Lisa" avatar_url={imageUrl} />
        </Example>
      </Section>

      <Section
        title="Initials fallback"
        description="When avatar_url is null the component shows initials derived from name."
      >
        <Example code={initialsCode}>
          <Box alignItems="center" columnGap="m">
            <Avatar name="Ada Lovelace" avatar_url={null} />
            <Avatar name="Grace Hopper" avatar_url={null} />
            <Avatar name="Alan Turing" avatar_url={null} />
          </Box>
        </Example>
      </Section>

      <Section
        title="Sizes"
        description="The avatar defaults to a 24px circle. Set the rendered size with className and pass matching height and width for the image."
      >
        <Example code={sizesCode}>
          <Box alignItems="center" columnGap="l">
            <Avatar name="Mona Lisa" avatar_url={imageUrl} />
            <Avatar
              name="Mona Lisa"
              avatar_url={imageUrl}
              height={40}
              width={40}
              className="h-10 w-10"
            />
            <Avatar
              name="Mona Lisa"
              avatar_url={imageUrl}
              height={64}
              width={64}
              className="h-16 w-16"
            />
          </Box>
        </Example>
      </Section>

      <Section
        title="Loading attribute"
        description="Set loading to lazy to defer offscreen avatar images."
      >
        <Example>
          <Box alignItems="center" columnGap="m">
            <Avatar name="Lazy User" avatar_url={imageUrl} loading="lazy" />
            <Text variant="caption" color="muted">
              loading=&quot;lazy&quot;
            </Text>
          </Box>
        </Example>
      </Section>

      <Section title="Props">
        <PropsTable rows={avatarProps} />
      </Section>
    </>
  )
}
