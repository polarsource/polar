import AddOutlined from '@mui/icons-material/AddOutlined'
import ClearOutlined from '@mui/icons-material/ClearOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useCallback } from 'react'

interface EventMetadataFilterForm {
  metadata: {
    key: string
    value: string | number | boolean
  }[]
  onChange: (
    metadata: { key: string; value: string | number | boolean }[],
  ) => void
}

export const EventMetadataFilter = ({
  metadata,
  onChange,
}: EventMetadataFilterForm) => {
  const onChangeValue = useCallback(
    (key: string, value: string | number | boolean, index: number) => {
      const parsedValue =
        value === 'true' || value === 'false'
          ? value === 'true'
          : value !== '' && !isNaN(Number(value))
            ? Number(value)
            : value

      const newMetadata = [...metadata]
      newMetadata[index] = {
        key: key.replaceAll(' ', '_').trim(),
        value: parsedValue,
      }
      onChange(newMetadata)
    },
    [onChange, metadata],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row items-center justify-between gap-2">
        <h3 className="text-sm">Metadata</h3>
        <Button
          className="size-6 rounded-full"
          size="icon"
          type="button"
          variant="secondary"
          onClick={() => {
            onChange(metadata.concat({ key: '', value: '' }))
          }}
        >
          <AddOutlined />
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {metadata.map((field, index) => (
          <div key={index} className="flex flex-row items-center gap-2">
            <Input
              value={field.key || ''}
              placeholder="Key"
              className="rounded-lg font-mono text-xs!"
              onChange={(e) => {
                onChangeValue(e.target.value, field.value, index)
              }}
            />
            <Input
              value={field.value?.toString() || ''}
              placeholder="Value"
              className="rounded-lg font-mono text-xs!"
              onChange={(e) => {
                onChangeValue(field.key, e.target.value, index)
              }}
            />
            <Button
              className={
                'size-6 border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
              }
              size="icon"
              variant="secondary"
              type="button"
              onClick={() => {
                onChange(metadata.filter((_, i) => i !== index))
              }}
            >
              <ClearOutlined fontSize="inherit" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
