import { Console } from '../Console'
import { Link } from '../Link'
import { Section } from '../Section'

export const UsageBasedSection = () => {
  return (
    <Section
      header={{ index: '01', name: 'Future is Usage Based' }}
      title="The future of payments is usage based"
      context={
        <Console
          title="NextJS Adapter"
          code={`import { Usage } from '@polar-sh/nextjs'
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai';

export const POST = Usage()
  .customer(req => req.headers.get('X-Polar-Customer-Id'))
  .model(openai('gpt-4o'))
  .increment('gpt-4o-inputs', ctx => ctx.usage.inputTokens)
  .increment('gpt-4o-outputs', ctx => ctx.usage.completionTokens)
  .handler((req, res, model) => {
    const { prompt }: { prompt: string } = await req.json();

    const result = streamText({
      model,
      system: 'You are a helpful assistant.',
      prompt,
    });

    return result.toDataStreamResponse();
})`}
        />
      }
    >
      <p>
        In a world where Artificial Intelligence is becoming more and more
        prevalent, the intelligence we consume will be charged based on usage.
        It&apos;s time for payment infrastructure, built for the 21st century.
      </p>
      <p>
        We believe that the future of payments is usage based, and we are
        committed to build the gold standard for adapters that sits in between
        artificial intelligence and the world.
      </p>
      <Link href="/pitch/what">Why →</Link>
    </Section>
  )
}
