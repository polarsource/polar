import { PageHeader, Prose, Section } from '@/components/docs'
import usage from '@/generated/icon-usage.json'
import { Text, Truncated } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import * as Icons from '@polar-sh/orbit/icons'
import type { ComponentType } from 'react'

type IconSource = 'lucide' | 'material'

interface IconUsage {
  source: IconSource
  original: string
  files: string[]
}

const ICONS = Object.entries(usage as Record<string, IconUsage>)
  .map(([name, icon]) => ({
    name,
    ...icon,
    Icon: (Icons as unknown as Record<string, ComponentType>)[name],
  }))
  .sort(
    (a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name),
  )

const SOURCES: { source: IconSource; title: string; description: string }[] = [
  {
    source: 'lucide',
    title: 'Lucide',
    description: 'Stroked icons from lucide-react.',
  },
  {
    source: 'material',
    title: 'Material',
    description:
      'Filled, outlined and rounded icons from @mui/icons-material, plus brand logos.',
  },
]

const IMPORT_CODE = `import { Check, MoreVertOutlined } from '@polar-sh/orbit/icons'`

function IconTile({ name, original, files, Icon }: (typeof ICONS)[number]) {
  return (
    <Box
      flexDirection="column"
      rowGap="s"
      padding="m"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      title={files.join('\n')}
    >
      <Box height={48} alignItems="center" justifyContent="center">
        <Icon />
      </Box>
      <Box flexDirection="column" rowGap="xs">
        <Truncated>
          <Text monospace color="inherit">
            {name}
          </Text>
        </Truncated>
        {original !== name && (
          <Text variant="caption" color="default">
            {original}
          </Text>
        )}
        <Text variant="caption" color="default">
          {files.length} {files.length === 1 ? 'file' : 'files'}
        </Text>
      </Box>
    </Box>
  )
}

export default function IconsPage() {
  const totalImports = ICONS.reduce((sum, icon) => sum + icon.files.length, 0)

  return (
    <>
      <PageHeader
        title="Icons"
        description="Every icon the Polar dashboard uses, served from one entry point."
      />

      <Section>
        <Prose>
          <Text variant="body" color="default">
            Import icons from @polar-sh/orbit/icons, never from lucide-react or
            @mui/icons-material directly. {ICONS.length} icons are in use across{' '}
            {totalImports} imports. Hover an icon to see the files that import
            it, and run pnpm gen:icons to refresh the counts.
          </Text>
          <Text monospace color="inherit">
            {IMPORT_CODE}
          </Text>
        </Prose>
      </Section>

      {SOURCES.map(({ source, title, description }) => {
        const icons = ICONS.filter((icon) => icon.source === source)
        return (
          <Section
            key={source}
            title={`${title} (${icons.length})`}
            description={description}
          >
            <Box
              display="grid"
              gridTemplateColumns={{
                base: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(3, minmax(0, 1fr))',
                lg: 'repeat(5, minmax(0, 1fr))',
              }}
              gap="m"
            >
              {icons.map((icon) => (
                <IconTile key={icon.name} {...icon} />
              ))}
            </Box>
          </Section>
        )
      })}
    </>
  )
}
