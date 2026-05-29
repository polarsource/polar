import { Section } from 'react-email'
import { PropsWithChildren } from 'react'

export function CTASection({ children }: PropsWithChildren<{}>) {
  return <Section className="my-8 text-center">{children}</Section>
}

export default CTASection
