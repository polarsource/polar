import { useListKeys } from '@/hooks/useListKeys'
import { Button, Input } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Plus, X } from '@polar-sh/orbit/icons'

type Entry = { key: string; value: string | number | boolean }

const FIELD_CLASS_NAME = 'h-8 rounded-lg px-2.5 text-xs md:text-xs'

export const EventMetadataFields = ({
  metadata,
  onChange,
}: {
  metadata: Entry[]
  onChange: (metadata: Entry[]) => void
}) => {
  const rowKeys = useListKeys(metadata.length)

  const update = (index: number, entry: Entry) =>
    onChange(
      metadata.map((current, i) =>
        i === index
          ? { key: entry.key.replaceAll(' ', '_').trim(), value: entry.value }
          : current,
      ),
    )

  return (
    <Box flexDirection="column" gap="s">
      <Box alignItems="center" justifyContent="between">
        <h3 className="text-sm">Metadata</h3>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          aria-label="Add metadata filter"
          onClick={() => onChange([...metadata, { key: '', value: '' }])}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </Box>
      {metadata.map((entry, index) => (
        <Box key={rowKeys.keys[index]} alignItems="center" gap="xs">
          <Input
            value={entry.key}
            placeholder="Key"
            className={FIELD_CLASS_NAME}
            onChange={(e) => update(index, { ...entry, key: e.target.value })}
          />
          <Input
            value={String(entry.value)}
            placeholder="Value"
            className={FIELD_CLASS_NAME}
            onChange={(e) => update(index, { ...entry, value: e.target.value })}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            aria-label="Remove metadata filter"
            onClick={() => {
              rowKeys.remove(index)
              onChange(metadata.filter((_, i) => i !== index))
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </Box>
      ))}
    </Box>
  )
}
