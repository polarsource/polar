import { SVGProps } from 'react'
import amex from './amex'
import diners from './diners'
import discover from './discover'
import hipercard from './hipercard'
import jcb from './jcb'
import mastercard from './mastercard'
import unionpay from './unionpay'
import unknown from './unknown'
import visa from './visa'

const getCardIcon = (brand: string) => {
  switch (brand) {
    case 'amex':
      return amex
    case 'diners':
      return diners
    case 'discover':
      return discover
    case 'hipercard':
      return hipercard
    case 'jcb':
      return jcb
    case 'mastercard':
      return mastercard
    case 'unionpay':
      return unionpay
    case 'visa':
      return visa
    default:
      return unknown
  }
}

const CreditCardBrandIcon = ({
  brand,
  ...props
}: SVGProps<SVGSVGElement> & { brand: string }) => {
  const Icon = getCardIcon(brand)
  return (
    <svg
      className="dark:border-polar-700 rounded-lg border border-gray-200 p-2"
      viewBox="0 0 24 16"
      {...props}
    >
      {Icon}
    </svg>
  )
}

export default CreditCardBrandIcon
