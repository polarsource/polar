import { Hero } from '@/components/Landing/Hero'
import { Journey } from '@/components/Landing/Journey'
import { Testamonials } from '@/components/Landing/Testamonials'
import { Separator } from 'polarkit/components/ui/separator'

export default function Page() {
  return (
    <div className="flex flex-col items-center">
      <Hero />
      <Journey />
      <Separator className="w-screen" />
      <Testamonials />
    </div>
  )
}
