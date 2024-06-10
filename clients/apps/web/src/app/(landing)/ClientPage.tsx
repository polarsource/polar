import { Hero } from '@/components/Landing/Hero'
import { Journey } from '@/components/Landing/Journey'
import { Testamonials } from '@/components/Landing/Testamonials'

export default function Page() {
  return (
    <div className="flex flex-col md:gap-y-16">
      <Hero />
      <Testamonials />
      <Journey />
    </div>
  )
}
