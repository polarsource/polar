import { PropsWithChildren } from 'react'
import LandingLayout from '../../../../components/Landing/LandingLayout'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function Layout({ children }: PropsWithChildren) {
  return <LandingLayout>{children}</LandingLayout>
}
