import { Heading, Text } from 'react-email'
import { PropsWithChildren } from 'react'

interface IntroProps {
  headline?: string
}

export function Intro({ headline, children }: PropsWithChildren<IntroProps>) {
  return (
    <>
      {headline && <Heading className="text-xl font-bold">{headline}</Heading>}
      {children && <Text className="text-[16px]">{children}</Text>}
    </>
  )
}

export default Intro
