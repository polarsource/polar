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
    <div className="dark:bg-polar-800 dark:text-polar-400 flex flex-row rounded-lg bg-gray-100 text-sm text-gray-500">
      {vals.map((v) => {
        return (
          <div
            key={v.label}
            onClick={() => props.onSelected(v.label)}
            className={classNames(
              v.selected
                ? 'dark:bg-polar-600 dark:text-polar-50 rounded-lg bg-white text-gray-900 shadow'
                : '',
              'cursor-pointer rounded-lg px-2.5 py-1.5',
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
