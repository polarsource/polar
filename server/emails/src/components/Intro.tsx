import { Heading, Section, Text } from '@react-email/components'
import { PropsWithChildren } from 'react'

interface IntroProps {
  headline?: string
}

export function Intro({ headline, children }: PropsWithChildren<IntroProps>) {
  return (
    <Section>
      {headline && <Heading className="text-lg font-bold">{headline}</Heading>}
      <Text className="text-base">{children}</Text>
    </Section>
  )
}

export default Intro
