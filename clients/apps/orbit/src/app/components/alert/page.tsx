'use client'

import { Alert, Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import type { PropRow } from '@/components/docs'
import { Example, PageHeader, PropsTable, Section } from '@/components/docs'

function DismissibleExample() {
  const [visible, setVisible] = useState(true)

  if (!visible) {
    return (
      <Button variant="secondary" onClick={() => setVisible(true)}>
        Show alert again
      </Button>
    )
  }

  return (
    <Alert
      variant="warning"
      title="Unsaved changes"
      description="Save before you leave, or dismiss this notice."
      onDismiss={() => setVisible(false)}
    />
  )
}

const variantsCode = `<Alert
  variant="info"
  title="For your information"
  description="A muted, neutral alert with no severity attached."
/>
<Alert
  variant="warning"
  title="Check your settings"
  description="Something needs your attention before continuing."
/>
<Alert
  variant="danger"
  title="Payment failed"
  description="We couldn't charge your card. Update it to retry."
/>
<Alert
  variant="success"
  title="All set"
  description="Your changes were saved successfully."
/>`

const titleOnlyCode = `<Alert variant="info" title="Title-only alerts are allowed too" />`

const loadingCode = `<Alert
  variant="info"
  title="Checking your domain"
  description="This usually takes a few seconds."
  loading
/>`

const dismissCode = `<Alert
  variant="warning"
  title="Unsaved changes"
  description="Save before you leave, or dismiss this notice."
  onDismiss={() => setVisible(false)}
/>`

const actionsCode = `<Alert
  variant="info"
  title="Update available"
  description="A new version is ready to install."
  actions={[
    { text: 'Update now', onClick: onUpdate },
    { text: 'Later', onClick: onDismiss },
  ]}
/>`

const alertProps: PropRow[] = [
  {
    name: 'variant',
    type: "'info' | 'warning' | 'danger' | 'success'",
    default: "'info'",
    description:
      'Picks the icon, surface tint and accent color in one go, mapping the alert to its meaning.',
  },
  {
    name: 'title',
    type: 'string',
    required: true,
    description: "The headline, rendered in the variant's accent color.",
  },
  {
    name: 'description',
    type: 'string',
    description:
      'Supporting copy beneath the title. Omit for a title-only alert.',
  },
  {
    name: 'loading',
    type: 'boolean',
    description:
      'Swaps the variant icon for a spinner while the alert subject resolves.',
  },
  {
    name: 'onDismiss',
    type: '() => void',
    description:
      'Called when the dismiss button is pressed. Provide it to render a dismiss button; omit for a persistent alert.',
  },
  {
    name: 'actions',
    type: 'ButtonGroupActions',
    description:
      'One or two call-to-action buttons, rendered bottom-right via ButtonGroup. The first is primary, the second a ghost button.',
  },
]

export default function AlertPage() {
  return (
    <>
      <PageHeader
        title="Alert"
        description="A tinted callout that communicates a message and its severity. The variant abstracts away the icon and every color decision, so styling is closed: there is no className escape hatch."
      />

      <Section
        title="Variants"
        description="A muted info default plus three severity variants. Each picks its own icon, tinted surface and accent color."
      >
        <Example code={variantsCode}>
          <Box flexDirection="column" rowGap="m">
            <Alert
              variant="info"
              title="For your information"
              description="A muted, neutral alert with no severity attached."
            />
            <Alert
              variant="warning"
              title="Check your settings"
              description="Something needs your attention before continuing."
            />
            <Alert
              variant="danger"
              title="Payment failed"
              description="We couldn't charge your card. Update it to retry."
            />
            <Alert
              variant="success"
              title="All set"
              description="Your changes were saved successfully."
            />
          </Box>
        </Example>
      </Section>

      <Section
        title="Title only"
        description="The description is optional. Omit it for a compact, single-line alert."
      >
        <Example code={titleOnlyCode}>
          <Alert variant="info" title="Title-only alerts are allowed too" />
        </Example>
      </Section>

      <Section
        title="Loading"
        description="Set loading to swap the variant icon for a spinner while the alert subject resolves. Colors and layout stay put."
      >
        <Example code={loadingCode}>
          <Alert
            variant="info"
            title="Checking your domain"
            description="This usually takes a few seconds."
            loading
          />
        </Example>
      </Section>

      <Section
        title="Dismissible"
        description="Pass onDismiss to render a dismiss button. The handler fires on press; the alert itself stays controlled by the caller."
      >
        <Example code={dismissCode}>
          <DismissibleExample />
        </Example>
      </Section>

      <Section
        title="Actions"
        description="Pass one or two actions to render call-to-action buttons bottom-right. The first is the primary button, the second a ghost button; they stack vertically on mobile."
      >
        <Example code={actionsCode}>
          <Alert
            variant="info"
            title="Update available"
            description="A new version is ready to install."
            actions={[
              { text: 'Update now', onClick: () => {} },
              { text: 'Later', onClick: () => {} },
            ]}
          />
        </Example>
      </Section>

      <Section
        title="Props"
        description="Alert has no className prop. The variant controls the icon and all colors."
      >
        <PropsTable rows={alertProps} slug="alert" />
      </Section>
    </>
  )
}
