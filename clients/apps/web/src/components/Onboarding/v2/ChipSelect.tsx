'use client'

interface ChipSelectProps {
  options: readonly string[]
  selected: string[]
  onChange: (selected: string[]) => void
  /** If true, only one option can be selected at a time (radio-like) */
  single?: boolean
}

export function ChipSelect({
  options,
  selected,
  onChange,
  single = false,
}: ChipSelectProps) {
  const toggle = (option: string) => {
    if (single) {
      onChange(selected.includes(option) ? [] : [option])
      return
    }
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option)
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              isSelected
                ? 'border-blue-500 bg-blue-500 font-medium text-white'
                : 'dark:border-polar-600 dark:text-polar-300 dark:hover:border-polar-400 border-gray-300 text-gray-700 hover:border-gray-400'
            }`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
