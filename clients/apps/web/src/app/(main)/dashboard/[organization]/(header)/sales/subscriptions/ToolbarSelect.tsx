import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@polar-sh/orbit'

interface ToolbarSelectProps<T extends string> {
  label: string
  showLabel?: boolean
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export const ToolbarSelect = <T extends string>({
  label,
  showLabel = true,
  value,
  options,
  onChange,
}: ToolbarSelectProps<T>) => (
  <Select value={value} onValueChange={(next) => onChange(next as T)}>
    <SelectTrigger
      aria-label={label}
      className="h-8 w-auto gap-x-1.5 rounded-full px-3 text-xs shadow-none [&>span]:text-xs"
    >
      {showLabel && (
        <Text variant="caption" color="muted" wrap="nowrap">
          {label}
        </Text>
      )}
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)
