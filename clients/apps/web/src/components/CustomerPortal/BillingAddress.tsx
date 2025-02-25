import { schemas } from '@polar-sh/client'

const BillingAddress = ({ address }: { address: schemas['Address'] }) => {
  return (
    <address className="not-italic">
      {address.line1 && <div>{address.line1}</div>}
      {address.line2 && <div>{address.line2}</div>}
      <div>
        {address.postal_code && <span>{address.postal_code}</span>}
        {address.state && <span> {address.state}</span>}
        {address.country && <span> {address.country}</span>}
      </div>
    </address>
  )
}

export default BillingAddress
