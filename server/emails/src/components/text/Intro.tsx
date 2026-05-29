import { PropsWithChildren } from 'react'
import Heading from './Heading'
import Text from './Text'

interface IntroProps {
  headline?: string
}

export function Intro({ headline, children }: PropsWithChildren<IntroProps>) {
  return (
    <>
      {headline && <Heading>{headline}</Heading>}
      {children && <Text>{children}</Text>}
    </>
  )
}

export default Intro
