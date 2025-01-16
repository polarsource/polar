import { CustomFieldType } from '@polar-sh/api'
import CustomFieldTypeIcon from './CustomFieldTypeIcon'

const getLabel = (type: CustomFieldType) => {
  switch (type) {
    case 'text':
      return 'Text'
    case 'number':
      return 'Number'
    case 'date':
      return 'Date'
    case 'checkbox':
      return 'Checkbox'
    case 'select':
      return 'Select'
  }
}

const CustomFieldTypeLabel = ({ type }: { type: CustomFieldType }) => {
  const label = getLabel(type)

  return (
    <div className="flex flex-row items-center gap-2">
      <CustomFieldTypeIcon type={type} />
      <div>{label}</div>
    </div>
  )
}

export default CustomFieldTypeLabel
