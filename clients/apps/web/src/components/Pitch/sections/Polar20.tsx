import { Console } from '../Console'
import { Link } from '../Link'
import { Section } from '../Section'

export const Polar20Section = () => {
  return (
    <Section
      header={{ index: '03', name: 'Polar 2.0' }}
      title="The future of payments is usage based"
      context={
        <Console
          title="NextJS Adapter"
          input={`import { Usage } from '@polar-sh/nextjs'
import { openai } from '@ai-sdk/openai'

export const POST = Usage()
  .customer(req => req.headers.get('X-Polar-Customer-Id'))
  .model(openai('gpt-4o'))
  .increment('gpt-4o-inputs', ctx => ctx.usage.inputTokens)
  .increment('gpt-4o-outputs', ctx => ctx.usage.completionTokens)
  .handler((req, res, model) => /** Use model... */)`}
        />
      }
    >
      <p>
        What used to be a simple way to pay for things has become a complex
        mess.
      </p>
      <p>
        Software as a Service (SaaS) has become the norm, but the underlying
        payment infrastructure has not evolved.
      </p>
      <p>
        This is why we are building Polar 2.0, payment infrastructure for the
        21st century.
      </p>
      <Link href="/pitch/what">Why →</Link>
    </Section>
  )
}
