import { CheckOutlined, CloseOutlined } from '@mui/icons-material'
import { CustomField } from '@polar-sh/sdk'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'polarkit/components/ui/tooltip'

const numberFormat = new Intl.NumberFormat(undefined, {})

const CustomFieldValue = ({
  field,
  value,
}: {
  field: CustomField
  value: string | number | boolean | undefined | null
}) => {
  if (value === undefined || value === null) {
    return '—'
  }

  switch (field.type) {
    case 'text':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-left">
              {value}
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-64 whitespace-pre-wrap">{value}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
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
