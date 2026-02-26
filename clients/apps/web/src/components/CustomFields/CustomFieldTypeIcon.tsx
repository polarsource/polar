import CalendarMonth from '@mui/icons-material/CalendarMonth'
import CheckBox from '@mui/icons-material/CheckBox'
import List from '@mui/icons-material/List'
import Numbers from '@mui/icons-material/Numbers'
import TextSnippet from '@mui/icons-material/TextSnippet'
import { schemas } from '@polar-sh/client'

const CustomFieldTypeIcon = ({
  type,
}: {
  type: schemas['CustomFieldType']
}) => {
  switch (type) {
    case 'text':
      return <TextSnippet fontSize="inherit" />
    case 'number':
      return <Numbers fontSize="inherit" />
    case 'date':
      return <CalendarMonth fontSize="inherit" />
    case 'checkbox':
      return <CheckBox fontSize="inherit" />
    case 'select':
      return <List fontSize="inherit" />
  }
}

export default CustomFieldTypeIcon
