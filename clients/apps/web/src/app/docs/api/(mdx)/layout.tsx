import { PropsWithChildren } from 'react'
import { MDXContentWrapper } from '../../MDXContentWrapper'

export default function Layout({ children }: PropsWithChildren) {
  return <MDXContentWrapper>{children}</MDXContentWrapper>
}
