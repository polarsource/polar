import { Text } from './foundation'

interface CustomerIdentityProps {
  name: string
  email?: string | null
}

export function CustomerIdentity({ name, email }: CustomerIdentityProps) {
  return (
    <>
      <Text as="span" weight="bold">
        {name}
      </Text>
      {email && email !== name && ` (${email})`}
    </>
  )
}

export default CustomerIdentity
