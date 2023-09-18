export const prettyCardName = (brand?: string) => {
  if (!brand) {
    return 'Saved Card'
  }

  if (brand.toLowerCase() === 'mastercard') {
    return 'MasterCard'
  }

  return brand[0].toUpperCase() + brand.slice(1)
}

export const validateEmail = (email: string) => {
  return email.includes('@')
}
