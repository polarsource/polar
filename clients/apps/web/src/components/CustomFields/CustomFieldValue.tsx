import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { schemas } from '@polar-sh/client'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'

const numberFormat = new Intl.NumberFormat(undefined, {})

const CustomFieldValue = ({
  field,
  value,
}: {
  field: schemas['CustomField']
  value: string | number | boolean | undefined | null
}) => {
  if (value === undefined || value === null) {
    return '—'
  }

  switch (field.type) {
    case 'text':
      return <TextArea className="text-xs" value={`${value}`} readOnly />
    case 'number':
      return numberFormat.format(value as number)
    case 'date':
      return <FormattedDateTime datetime={value as string} />
    case 'checkbox':
      return value === true ? (
        <CheckOutlined fontSize="inherit" />
      ) : (
        <CloseOutlined fontSize="inherit" />
      )
    case 'select':
      const option = field.properties.options.find(
        (option) => option.value === value,
      )
      return option ? option.label : value
  }
}

export default CustomFieldValue
