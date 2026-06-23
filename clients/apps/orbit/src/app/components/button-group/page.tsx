'use client'

import { ButtonGroup } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { PropRow } from '@/components/docs'
import { Example, PageHeader, PropsTable, Section } from '@/components/docs'

const singleCode = `<ButtonGroup actions={[{ text: 'Save', onClick: onSave }]} />`

const pairCode = `<ButtonGroup
  actions={[
    { text: 'Save changes', onClick: onSave },
    { text: 'Cancel', onClick: onCancel },
  ]}
/>`

const statesCode = `<ButtonGroup
  actions={[
    { text: 'Saving', onClick: onSave, loading: true },
    { text: 'Cancel', onClick: onCancel, disabled: true },
  ]}
/>`

const buttonGroupProps: PropRow[] = [
  {
    name: 'actions',
    type: 'readonly [ButtonGroupAction] | readonly [ButtonGroupAction, ButtonGroupAction]',
    required: true,
    description:
      'One or two actions, as a tuple. The first renders as the primary (default) button, the second as a ghost button. Each action takes text, onClick, loading and disabled — variant and size are owned by the group.',
  },
  {
    name: 'size',
    type: "'default' | 'sm' | 'lg' | 'icon'",
    default: "'default'",
    description: 'Button size applied to every action in the group.',
  },
]

export default function ButtonGroupPage() {
  return (
    <>
      <PageHeader
        title="ButtonGroup"
        description="Renders one or two related actions. The first is the primary button, the second a quieter ghost companion, so emphasis can never collide. The actions tuple caps the group at two at the type level."
      />

      <Section
        title="Single action"
        description="A lone action renders as the primary button."
      >
        <Example code={singleCode}>
          <ButtonGroup actions={[{ text: 'Save', onClick: () => {} }]} />
        </Example>
      </Section>

      <Section
        title="Two actions"
        description="With two actions, the first is primary and the second is a ghost button. They stack vertically on mobile and sit in a row from the small breakpoint up."
      >
        <Example code={pairCode}>
          <Box maxWidth={360}>
            <ButtonGroup
              actions={[
                { text: 'Save changes', onClick: () => {} },
                { text: 'Cancel', onClick: () => {} },
              ]}
            />
          </Box>
        </Example>
      </Section>

      <Section
        title="Loading & disabled"
        description="Each action can show a spinner via loading or be disabled — derived straight from the Button API."
      >
        <Example code={statesCode}>
          <ButtonGroup
            actions={[
              { text: 'Saving', onClick: () => {}, loading: true },
              { text: 'Cancel', onClick: () => {}, disabled: true },
            ]}
          />
        </Example>
      </Section>

      <Section
        title="Props"
        description="ButtonGroup owns variant and size; actions can pass Button props (for example onClick, loading, and disabled) plus text."
      >
        <PropsTable rows={buttonGroupProps} slug="button-group" />
      </Section>
    </>
  )
}
