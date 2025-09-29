import Features from '@/components/Landing/Features'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Section } from '../Section'

export const IndexSection = ({ active }: { active: boolean }) => {
  return (
    <Section
      active={active}
      header={{ index: '00', name: 'Index' }}
      title="Monetize your software"
      context={<Features />}
    >
      <p>Turn your software into a business with 6 lines of code.</p>
      <div className="flex flex-row gap-x-2">
        <Button className="flex-1 rounded-none bg-white text-black">
          Get Started
        </Button>
        <Button className="flex-1 rounded-none" variant="secondary">
          Why Polar
        </Button>
      </div>
    </Section>
  )
}
