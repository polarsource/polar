import { classNames } from 'polarkit/utils'

const LabeledRadioButton = (props: {
  values: string[]
  value: string
  onSelected: (value: string) => void
}) => {
  const vals = props.values.map((v) => {
    return {
      label: v,
      selected: v === props.value,
    }
  })

  return (
    <div className="flex flex-row rounded-lg bg-gray-100 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      {vals.map((v) => {
        return (
          <div
            key={v.label}
            onClick={() => props.onSelected(v.label)}
            className={classNames(
              v.selected
                ? 'rounded-lg bg-white text-gray-900 shadow dark:bg-gray-500 dark:text-gray-50'
                : '',
              'cursor-pointer rounded-lg py-1.5 px-2.5',
            )}
          >
            {v.label}
          </div>
        )
      })}
    </div>
  )
}

export default LabeledRadioButton
