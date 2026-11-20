import { twMerge } from 'tailwind-merge'

// Looks like the small SegmentedControl, but any number of tabs can be on.
const LIST_CLASS =
  'dark:bg-polar-800 flex items-center gap-x-1 rounded-full bg-gray-50 p-1'
const TAB_CLASS =
  'cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors'
const TAB_ON_CLASS =
  'dark:bg-polar-700 bg-white text-black shadow-lg dark:text-white'
const TAB_OFF_CLASS =
  'dark:text-polar-500 text-gray-500 hover:text-gray-900 dark:hover:text-white'

interface ToolbarMultiTabsProps<T extends string> {
  label: string
  // The tab that stands for no selection, and clears it.
  allLabel: string
  value: T[]
  options: { value: T; label: string }[]
  onChange: (value: T[]) => void
}

export const ToolbarMultiTabs = <T extends string>({
  label,
  allLabel,
  value,
  options,
  onChange,
}: ToolbarMultiTabsProps<T>) => {
  // Kept in the order of the options, whatever order they were picked in.
  const toggle = (toggled: T) =>
    onChange(
      options
        .map((option) => option.value)
        .filter((option) =>
          option === toggled ? !value.includes(option) : value.includes(option),
        ),
    )
  const tabs = [
    {
      key: '',
      label: allLabel,
      isOn: value.length === 0,
      onSelect: () => onChange([]),
    },
    ...options.map((option) => ({
      key: option.value,
      label: option.label,
      isOn: value.includes(option.value),
      onSelect: () => toggle(option.value),
    })),
  ]

  return (
    <div role="group" aria-label={label} className={LIST_CLASS}>
      {tabs.map(({ key, label, isOn, onSelect }) => (
        <button
          key={key}
          type="button"
          aria-pressed={isOn}
          className={twMerge(TAB_CLASS, isOn ? TAB_ON_CLASS : TAB_OFF_CLASS)}
          onClick={onSelect}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
