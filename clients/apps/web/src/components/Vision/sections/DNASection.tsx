import { Console } from '../Console'
import { Grid } from '../Grid'
import { Section } from '../Section'

export const DNASection = () => {
  return (
    <Section
      header={{ index: '02', name: 'DX as DNA' }}
      title="Developer Experience as Polar DNA"
      context={
        <div className="flex flex-col gap-y-8">
          <div className="relative">
            <div
              className="absolute left-2 top-2 z-0 flex h-full w-full flex-col items-center justify-center text-black md:left-4 md:top-4"
              style={{
                background:
                  'repeating-linear-gradient(-45deg, transparent 0px, transparent 9px, hsl(233, 8%, 24%) 9px, hsl(233, 8%, 24%) 10px)',
              }}
            />
            <Grid
              className="relative z-10 grid-cols-2 text-xs md:grid-cols-4"
              items={[
                <span
                  key="a"
                  className="bg-polar-200 absolute bottom-2 right-2 flex h-full w-full flex-col items-center justify-center text-black md:bottom-4 md:right-4"
                >
                  TypeScript SDK
                </span>,
                <span key="b">Python SDK</span>,
                <span key="c">Go SDK</span>,
                <span key="c">PHP SDK</span>,
              ]}
            />
          </div>
          <Grid
            className="grid-cols-2 text-xs md:grid-cols-4"
            items={[
              <span key="e">@polar-sh/nextjs</span>,
              <span key="f">@polar-sh/fastify</span>,
              <span key="g">@polar-sh/astro</span>,
              <span key="h">@polar-sh/deno</span>,
            ]}
          />
          <Console
            code={`import { Checkout } from '@polar-sh/nextjs'

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  successUrl: process.env.SUCCESS_URL
})
`}
          />
        </div>
      }
    >
      <p>
        Polar aims to be the simplest way to integrate payments into your
        software. This should be a breeze. That&apos;s why we restrict the code
        you need to a maximum of 7 lines.
      </p>
    </Section>
  )
}
