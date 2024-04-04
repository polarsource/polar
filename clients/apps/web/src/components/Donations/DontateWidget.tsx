import { AttachMoneyOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { getCentsInDollarString } from 'polarkit/money'
import { organizationPageLink } from 'polarkit/utils/nav'
import { ChangeEvent, useState } from 'react'

export interface DonateWidgetProps {
  organization: Organization
}

export const DonateWidget = ({ organization }: DonateWidgetProps) => {
  const [amount, setAmount] = useState<number>(1000)

  const getCents = (event: ChangeEvent<HTMLInputElement>) => {
    let newAmount = parseInt(event.target.value)
    if (isNaN(newAmount)) {
      newAmount = 0
    }
    const amountInCents = newAmount * 100
    return amountInCents
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAmount(getCents(e))
  }

  return (
    <div className="flex w-full flex-row items-center gap-x-2">
      <Input
        className="w-full rounded-full px-8"
        preSlot={<AttachMoneyOutlined fontSize="small" />}
        value={getCentsInDollarString(amount)}
        onChange={onChange}
      />
      <Link
        href={organizationPageLink(organization, `donate?amount=${amount}`)}
      >
        <Button>Donate</Button>
      </Link>
    </div>
  )
}
