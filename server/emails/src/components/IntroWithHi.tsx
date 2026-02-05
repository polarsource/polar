import { Section, Text } from '@react-email/components'
import { PropsWithChildren } from 'react'

interface IntroWithHiProps {
  hiMsg?: string
}

export function IntroWithHi({
  hiMsg = 'Hi,',
  children,
}: PropsWithChildren<IntroWithHiProps>) {
  return (
    <Section>
      <Text className="text-[22px] font-bold">{hiMsg}</Text>
      <Text className="text-[16px]">{children}</Text>
    </Section>
  )
}

export default IntroWithHi
