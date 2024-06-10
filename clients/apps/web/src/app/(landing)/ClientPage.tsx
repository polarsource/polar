import { Hero } from '@/components/Landing/Hero'
import { Journey } from '@/components/Landing/Journey'
import { Testamonials } from '@/components/Landing/Testamonials'
import { Separator } from '@radix-ui/react-dropdown-menu'

export default function Page() {
  return (
    <div className="flex flex-col md:gap-y-16">
      <Hero />
      <Testamonials />
      <Separator />
      <Journey />
    </div>
  )
}
