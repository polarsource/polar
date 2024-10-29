import {
  CalendarMonth,
  CheckBox,
  List,
  Numbers,
  TextSnippet,
} from '@mui/icons-material'
import { CustomFieldType } from '@polar-sh/sdk'

const getIcon = (type: CustomFieldType) => {
  switch (type) {
    case 'text':
      return TextSnippet
    case 'number':
      return Numbers
    case 'datetime':
      return CalendarMonth
    case 'checkbox':
      return CheckBox
    case 'select':
      return List
  }
}

const getLabel = (type: CustomFieldType) => {
  switch (type) {
    case 'text':
      return 'Text'
    case 'number':
      return 'Number'
    case 'datetime':
      return 'Date & Time'
    case 'checkbox':
      return 'Checkbox'
    case 'select':
      return 'Select'
  }
}

const CustomFieldTypeLabel = ({ type }: { type: CustomFieldType }) => {
  const Icon = getIcon(type)
  const label = getLabel(type)

  return (
    <div className="flex flex-row items-center gap-1">
      <Icon fontSize="inherit" />
      <div>{label}</div>
    </div>
  )
}

export default CustomFieldTypeLabel
