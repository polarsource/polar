import { schemas } from '@spaire/client'
import CustomFieldTypeIcon from './CustomFieldTypeIcon'

const getLabel = (type: schemas['CustomFieldType']) => {
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

const CustomFieldTypeLabel = ({
  type,
}: {
  type: schemas['CustomFieldType']
}) => {
  const label = getLabel(type)

  return (
    <div className="flex flex-row items-center gap-2">
      <CustomFieldTypeIcon type={type} />
      <div>{label}</div>
    </div>
  )
}

export default CustomFieldTypeLabel
