import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { Section } from './Section'
import { APIFirst } from './molecules/APIFirst'

export const API = () => {
  return (
    <Section className="flex flex-col items-center justify-center gap-y-16">
      <APIFirst />
      <div className="flex flex-col items-center gap-y-12 text-center">
        <h1 className="text-5xl">Our API sits in the front seat</h1>
        <p className="dark:text-polar-200 text-lg text-gray-500">
          We built Polar with the developer experience in mind
        </p>
        <Link href="/docs/api-reference/introduction">
          <Button size="lg">Explore the Polar API</Button>
        </Link>
      </div>
    </Section>
  )
}
