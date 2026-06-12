import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight, Plus, Trash } from 'lucide-react'
import type { PropRow } from '@/components/docs'
import { Example, PageHeader, PropsTable, Section } from '@/components/docs'

const variantsCode = `<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="link">Link</Button>`

const sizesCode = `<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Plus /></Button>`

const iconCode = `<Button>
  <Plus className="mr-2 h-4 w-4" />
  New project
</Button>
<Button variant="secondary">
  Continue
  <ArrowRight className="ml-2 h-4 w-4" />
</Button>`

const statesCode = `<Button loading>Saving</Button>
<Button disabled>Disabled</Button>
<Button fullWidth>Full width</Button>`

const buttonProps: PropRow[] = [
  {
    name: 'variant',
    type: "'default' | 'destructive' | 'outline' | 'secondary' | 'link' | 'ghost'",
    default: "'default'",
    description: 'Visual treatment of the button.',
  },
  {
    name: 'size',
    type: "'default' | 'sm' | 'lg' | 'icon'",
    default: "'default'",
    description:
      'Controls height and padding. Use icon for a square icon-only button.',
  },
  {
    name: 'loading',
    type: 'boolean',
    default: 'false',
    description:
      'Shows a centered spinner and disables interaction while keeping the layout stable.',
  },
  {
    name: 'fullWidth',
    type: 'boolean',
    default: 'false',
    description: 'Stretches the button to fill the width of its container.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'Prevents interaction and reduces opacity.',
  },
  {
    name: 'wrapperClassNames',
    type: 'string',
    description:
      'Classes applied to the inner content wrapper that lays out children.',
  },
  {
    name: 'type',
    type: "'button' | 'submit' | 'reset'",
    default: "'button'",
    description: 'Native button type.',
  },
  {
    name: 'onClick',
    type: '(event) => void',
    description: 'Click handler, forwarded to the underlying button element.',
  },
  {
    name: 'children',
    type: 'ReactNode',
    description: 'Button label and optional icons.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Classes merged onto the button element.',
  },
]

export default function ButtonPage() {
  return (
    <>
      <PageHeader
        title="Button"
        description="The primary action element. Built with Tailwind and class-variance-authority, with variants, sizes and a stable loading state."
      />

      <Section
        title="Variants"
        description="Treatments cover primary, secondary and tertiary actions, plus an inline link style."
      >
        <Example code={variantsCode}>
          <Box alignItems="center" columnGap="m" rowGap="m" flexWrap="wrap">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </Box>
        </Example>
      </Section>

      <Section
        title="Sizes"
        description="Three text sizes plus a square icon size for icon-only actions."
      >
        <Example code={sizesCode}>
          <Box alignItems="center" columnGap="m" rowGap="m" flexWrap="wrap">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">
              <Plus />
            </Button>
          </Box>
        </Example>
      </Section>

      <Section
        title="With icons"
        description="Place lucide-react icons before or after the label inside children."
      >
        <Example code={iconCode}>
          <Box alignItems="center" columnGap="m" rowGap="m" flexWrap="wrap">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New project
            </Button>
            <Button variant="secondary">
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="destructive">
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </Box>
        </Example>
      </Section>

      <Section
        title="States"
        description="Loading swaps the label for a spinner without shifting layout. Disabled blocks interaction, and fullWidth fills the container."
      >
        <Example code={statesCode} align="stretch">
          <Box flexDirection="column" rowGap="l">
            <Box alignItems="center" columnGap="m" rowGap="m" flexWrap="wrap">
              <Button loading>Saving</Button>
              <Button disabled>Disabled</Button>
            </Box>
            <Button fullWidth>Full width</Button>
          </Box>
        </Example>
      </Section>

      <Section
        title="Props"
        description="Button extends the native button attributes. The most relevant props are listed below."
      >
        <PropsTable rows={buttonProps} slug="button" />
      </Section>
    </>
  )
}
