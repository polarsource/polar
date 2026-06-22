import { benefitsDisplayNames } from '@/components/Benefit/utils'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import FilterList from '@mui/icons-material/FilterList'
import { enums, schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { twMerge } from 'tailwind-merge'

export const BenefitTypeFilter = ({
  value,
  onChange,
}: {
  value: schemas['BenefitType'] | null
  onChange: (value: schemas['BenefitType'] | null) => void
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <FilterList fontSize="small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onChange(null)}>
          <CheckOutlined className={twMerge('h-4 w-4', value && 'invisible')} />
          <Text as="span">All</Text>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {[...enums.benefitTypeValues]
          .sort((a, b) =>
            benefitsDisplayNames[a].localeCompare(benefitsDisplayNames[b]),
          )
          .map((type) => (
            <DropdownMenuItem key={type} onClick={() => onChange(type)}>
              <CheckOutlined
                className={twMerge('h-4 w-4', value !== type && 'invisible')}
              />
              <Text as="span">{benefitsDisplayNames[type]}</Text>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
