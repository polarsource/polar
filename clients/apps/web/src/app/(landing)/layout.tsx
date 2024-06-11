import { PropsWithChildren } from 'react'
import LandingLayout from '../../components/Landing/LandingLayout'

export default function Layout({ children }: PropsWithChildren) {
  return <LandingLayout>{children}</LandingLayout>
}
