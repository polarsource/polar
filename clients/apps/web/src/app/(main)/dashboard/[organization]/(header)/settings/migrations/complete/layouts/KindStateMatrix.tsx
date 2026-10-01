import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { KIND_LABELS, STATE_LABELS } from '../completeCopy'
import { MAPPING_KINDS, MappingKind, MappingState } from '../idMapping'
import { MATRIX_STATES } from '../viewModels'
import { numberFormat } from './shared'

export interface MatrixFilter {
  kind: MappingKind | null
  state: MappingState | null
}

const cellBorder = {
  borderStyle: 'solid',
  borderColor: 'border-primary',
  borderTopWidth: 1,
} as const

function MatrixCell({
  value,
  active,
  onClick,
}: {
  value: number
  active: boolean
  onClick: () => void
}) {
  return (
    <Box
      {...cellBorder}
      paddingHorizontal="m"
      paddingVertical="s"
      justifyContent="end"
      cursor={value > 0 ? { hover: 'pointer' } : undefined}
      backgroundColor={{
        base: active ? 'background-accent' : 'background-primary',
        hover: value > 0 ? 'background-secondary' : 'background-primary',
      }}
      onClick={() => value > 0 && onClick()}
    >
      <Text
        variant="caption"
        tabularNums
        color={value > 0 ? 'default' : 'muted'}
      >
        {value > 0 ? numberFormat.format(value) : '–'}
      </Text>
    </Box>
  )
}

export function KindStateMatrix({
  matrix,
  filter,
  onFilter,
}: {
  matrix: Record<MappingKind, Record<MappingState, number>>
  filter: MatrixFilter
  onFilter: (filter: MatrixFilter) => void
}) {
  const states = MATRIX_STATES.filter((state) =>
    MAPPING_KINDS.some((kind) => matrix[kind][state] > 0),
  )
  const template = `minmax(120px, 1.2fr) repeat(${states.length + 1}, minmax(72px, 1fr))`
  const cellProps = (kind: MappingKind, state: MappingState | null) => {
    const active = filter.kind === kind && filter.state === state
    return {
      active,
      onClick: () =>
        onFilter(active ? { kind: null, state: null } : { kind, state }),
    }
  }

  return (
    <Box
      display="grid"
      gridTemplateColumns={template}
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="m"
      overflow="hidden"
    >
      <Box
        paddingHorizontal="m"
        paddingVertical="s"
        backgroundColor="background-secondary"
      />
      {[...states.map((state) => STATE_LABELS[state]), 'Total'].map((label) => (
        <Box
          key={label}
          paddingHorizontal="m"
          paddingVertical="s"
          justifyContent="end"
          backgroundColor="background-secondary"
        >
          <Text variant="caption" color="muted" truncate>
            {label}
          </Text>
        </Box>
      ))}
      {MAPPING_KINDS.map((kind) => {
        const total = states.reduce(
          (sum, state) => sum + matrix[kind][state],
          0,
        )
        return [
          <Box
            key={kind}
            {...cellBorder}
            paddingHorizontal="m"
            paddingVertical="s"
          >
            <Text variant="caption">{KIND_LABELS[kind]}</Text>
          </Box>,
          ...states.map((state) => (
            <MatrixCell
              key={`${kind}:${state}`}
              value={matrix[kind][state]}
              {...cellProps(kind, state)}
            />
          )),
          <MatrixCell
            key={`${kind}:total`}
            value={total}
            {...cellProps(kind, null)}
          />,
        ]
      })}
    </Box>
  )
}
