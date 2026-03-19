import CalendarMonth from '@mui/icons-material/CalendarMonth'
import CheckBox from '@mui/icons-material/CheckBox'
import List from '@mui/icons-material/List'
import Numbers from '@mui/icons-material/Numbers'
import TextSnippet from '@mui/icons-material/TextSnippet'
import { schemas } from '@polar-sh/client'

const iconMap: Record<schemas['CustomFieldType'], typeof TextSnippet> = {
  text: TextSnippet,
  number: Numbers,
  date: CalendarMonth,
  checkbox: CheckBox,
  select: List,
}

const CustomFieldTypeIcon = ({
  type,
}: {
  type: schemas['CustomFieldType']
}) => {
  const Icon = iconMap[type]

  return <Icon fontSize="inherit" />
}

export default CustomFieldTypeIcon
