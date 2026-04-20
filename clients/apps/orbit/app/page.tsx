import { LandingNav } from './components/landing/LandingNav'
import { LandingArchitecture } from './components/landing/LandingArchitecture'
import { LandingProduct } from './components/landing/LandingProduct'
import { LandingTestimonials } from './components/landing/LandingTestimonials'
import { LandingCTA } from './components/landing/LandingCTA'
import { LandingFooter } from './components/landing/LandingFooter'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-black">
      <LandingNav />
      <LandingArchitecture />
      <LandingProduct />
      <LandingTestimonials />
      <LandingCTA />
      <LandingFooter />
    </div>
  )
}
