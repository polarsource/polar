import Heading from './Heading'
import Text from './Text'

interface IntroProps {
  headline?: string
  children?: React.ReactNode
}

export function Intro({ headline, children }: IntroProps) {
  return (
    <>
      {headline ? <Heading>{headline}</Heading> : null}
      {children ? <Text>{children}</Text> : null}
    </>
  )
}

export default Intro
