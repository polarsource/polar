import { Box } from '@polar-sh/orbit/Box'

export const SettingsGroup: React.FC<React.PropsWithChildren> = ({
  children,
}) => (
  <div className="dark:ring-polar-700 dark:bg-polar-900 dark:divide-polar-700 w-full flex-col divide-y divide-gray-200 overflow-hidden rounded-2xl bg-transparent ring-1 ring-gray-200 dark:ring-1">
    {children}
  </div>
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
      alignItems: 'start',
      justifyContent: 'between',
    },
    label: { minWidth: 0, flex: 1, maxWidth: { md: '50%' } },
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
    <Box padding="l" rowGap="l" {...row}>
      <Box flexDirection="column" {...label}>
        <h3 className="text-sm font-medium">{title}</h3>
        {description && (
          <p className="dark:text-polar-500 text-xs text-gray-500">
            {description}
          </p>
        )}
      </Box>
      {children && (
        <Box flexDirection="row" rowGap="s" {...control}>
          {children}
        </Box>
      )}
    </Box>
  )
}
