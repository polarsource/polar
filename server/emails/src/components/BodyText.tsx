import { Text } from '@react-email/components'
import { PropsWithChildren } from 'react'

export function BodyText({ children }: PropsWithChildren<{}>) {
  return <Text className="text-[16px]">{children}</Text>
}

export default BodyText
