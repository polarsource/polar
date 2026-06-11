import { Spinner, SpinnerNoMargin } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import type { PropRow } from '@/components/docs'
import { Example, PageHeader, PropsTable, Section } from '@/components/docs'

const basicCode = `<Spinner />`

const noMarginCode = `<SpinnerNoMargin />
<SpinnerNoMargin className="h-4 w-4" />
<SpinnerNoMargin className="h-8 w-8" />`

const colorCode = `<Box color="text-primary"><SpinnerNoMargin /></Box>
<Box color="text-secondary"><SpinnerNoMargin /></Box>
<Box color="text-success"><SpinnerNoMargin /></Box>
<Box color="text-danger"><SpinnerNoMargin /></Box>`

const spinnerProps: PropRow[] = [
  {
    name: 'className',
    type: 'string',
    default: "'h-5 w-5'",
    description:
      'SpinnerNoMargin only. Sets the size and any extra classes. Spinner itself takes no props and ships with a fixed size and left margin.',
  },
]

export default function SpinnerPage() {
  return (
    <>
      <PageHeader
        title="Spinner"
        description="A simple loading indicator. Spinner ships with a built-in left margin for inline use, while SpinnerNoMargin is sizeable via className. Both inherit color from the current text color."
      />

      <Section
        title="Spinner"
        description="The default spinner has a fixed size and a left margin, suited to sitting beside text."
      >
        <Example code={basicCode}>
          <Spinner />
        </Example>
      </Section>

      <Section
        title="SpinnerNoMargin"
        description="Drops the margin and accepts className for sizing. Use it inside buttons, badges and tight layouts."
      >
        <Example code={noMarginCode}>
          <Box alignItems="center" columnGap="l">
            <SpinnerNoMargin />
            <SpinnerNoMargin className="h-4 w-4" />
            <SpinnerNoMargin className="h-8 w-8" />
          </Box>
        </Example>
      </Section>

      <Section
        title="Color"
        description="Both spinners draw with currentColor, so they take on the text color of their container. Set it with a Box color token."
      >
        <Example code={colorCode}>
          <Box alignItems="center" columnGap="l">
            <Box color="text-primary">
              <SpinnerNoMargin />
            </Box>
            <Box color="text-secondary">
              <SpinnerNoMargin />
            </Box>
            <Box color="text-success">
              <SpinnerNoMargin />
            </Box>
            <Box color="text-danger">
              <SpinnerNoMargin />
            </Box>
          </Box>
        </Example>
      </Section>

      <Section
        title="Inline with text"
        description="Spinner reads well next to a label thanks to its built-in margin."
      >
        <Example>
          <Box alignItems="center">
            <Spinner />
            <Text color="muted">Loading</Text>
          </Box>
        </Example>
      </Section>

      <Section title="Props">
        <PropsTable rows={spinnerProps} />
      </Section>
    </>
  )
}
