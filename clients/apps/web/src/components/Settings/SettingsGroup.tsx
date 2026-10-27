import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Children, Fragment } from 'react'

export interface SettingsGroupProps {
  title?: string
  description?: React.ReactNode
}

export const SettingsSection: React.FC<
  React.PropsWithChildren<SettingsGroupProps>
> = ({ children, title, description }) => (
  <Box as="section" flexDirection="column" rowGap="m" width="100%">
    {(title || description) && (
      <Box flexDirection="column" rowGap="xs">
        {title && (
          <Text as="h2" variant="body">
            {title}
          </Text>
        )}
        {description && (
          <Text variant="caption" color="muted">
            {description}
          </Text>
        )}
      </Box>
    )}
    {children}
  </Box>
)

export const SettingsGroup: React.FC<
  React.PropsWithChildren<SettingsGroupProps>
> = ({ children, ...sectionProps }) => (
  <SettingsSection {...sectionProps}>
    <Box
      flexDirection="column"
      width="100%"
      overflow="hidden"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-secondary"
    >
      {Children.toArray(children).map((child, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <Box
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            />
          )}
          {child}
        </Fragment>
      ))}
    </Box>
  </SettingsSection>
)

export const SettingsGroupRow: React.FC<React.PropsWithChildren> = ({
  children,
}) => (
  <Box flexDirection="column" paddingHorizontal="xl" paddingVertical="l">
    {children}
  </Box>
)

const layouts = {
  split: {
    row: {
      flexDirection: { base: 'column', md: 'row' },
      columnGap: '3xl',
      alignItems: { md: 'start' },
      justifyContent: { md: 'between' },
    },
    label: { width: '100%', maxWidth: { md: '50%' } },
    control: { width: '100%', justifyContent: { md: 'end' } },
  },
  stacked: {
    row: { flexDirection: 'column', columnGap: '3xl' },
    label: { width: '100%', maxWidth: { md: '50%' } },
    control: { width: '100%' },
  },
  inline: {
    row: {
      flexDirection: 'row',
      columnGap: { base: 'l', md: '3xl' },
      alignItems: 'center',
      justifyContent: 'between',
    },
    label: { minWidth: 0, flex: 1 },
    control: { flexShrink: 0, justifyContent: 'end' },
  },
} as const

export interface SettingsGroupItemProps {
  title: React.ReactNode
  description?: React.ReactNode
  layout?: keyof typeof layouts
}

export const SettingsGroupItem: React.FC<
  React.PropsWithChildren<SettingsGroupItemProps>
> = ({ children, title, description, layout = 'split' }) => {
  const { row, label, control } = layouts[layout]

  return (
    <Box paddingHorizontal="xl" paddingVertical="l" rowGap="l" {...row}>
      <Box flexDirection="column" rowGap="xs" {...label}>
        <Text as="h3" variant="title">
          {title}
        </Text>
        {description && <Text color="muted">{description}</Text>}
      </Box>
      {children && (
        <Box flexDirection="row" rowGap="s" {...control}>
          {children}
        </Box>
      )}
    </Box>
  )
}
