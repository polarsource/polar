import { cva, type VariantProps } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

const segmentedControlVariants = cva('flex items-center gap-x-1 p-1', {
  variants: {
    size: {
      sm: 'rounded-full',
      md: 'rounded-full',
      lg: 'rounded-full',
    },
    variant: {
      default: 'dark:bg-polar-800 bg-gray-50',
      tabs: 'dark:bg-polar-950 w-full bg-gray-100',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
})

const segmentedControlItemVariants = cva(
  'cursor-pointer font-medium transition-colors',
  {
    variants: {
      size: {
        sm: 'px-2.5 py-1 text-xs',
        md: 'px-3 py-1.5 text-xs',
        lg: 'px-4 py-2 text-sm',
      },
      variant: {
        default: 'rounded-full',
        tabs: 'grow rounded-full',
      },
      active: {
        true: '',
        false:
          'dark:text-polar-500 text-gray-500 hover:text-gray-900 dark:hover:text-white',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        active: true,
        className:
          'dark:bg-polar-700 bg-white text-black shadow-lg dark:text-white',
      },
      {
        variant: 'tabs',
        active: true,
        className:
          'dark:bg-polar-800 bg-white text-black shadow-lg dark:text-white',
      },
    ],
    defaultVariants: {
      size: 'md',
      variant: 'default',
      active: false,
    },
  },
)

interface SegmentedControlOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: VariantProps<typeof segmentedControlVariants>['size']
  variant?: VariantProps<typeof segmentedControlVariants>['variant']
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size,
  variant,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={twMerge(
        segmentedControlVariants({ size, variant }),
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={segmentedControlItemVariants({
            size,
            variant,
            active: value === option.value,
          })}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
