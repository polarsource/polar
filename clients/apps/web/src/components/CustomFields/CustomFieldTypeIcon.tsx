import {
  CalendarMonth,
  CheckBox,
  List,
  Numbers,
  TextSnippet,
} from '@polar-sh/orbit/icons'
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
