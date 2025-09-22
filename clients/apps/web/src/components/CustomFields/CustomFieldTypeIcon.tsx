import CalendarMonth from '@mui/icons-material/CalendarMonth'
import CheckBox from '@mui/icons-material/CheckBox'
import List from '@mui/icons-material/List'
import Numbers from '@mui/icons-material/Numbers'
import TextSnippet from '@mui/icons-material/TextSnippet'
import { schemas } from '@polar-sh/client'

const getIcon = (type: schemas['CustomFieldType']) => {
  switch (type) {
    case 'text':
      return TextSnippet
    case 'number':
      return Numbers
    case 'date':
      return CalendarMonth
    case 'checkbox':
      return CheckBox
    case 'select':
      return List
  }
}

const CustomFieldTypeIcon = ({
  type,
}: {
  type: schemas['CustomFieldType']
}) => {
  const Icon = getIcon(type)

  return <Icon fontSize="inherit" />
}

export default CustomFieldTypeIcon
