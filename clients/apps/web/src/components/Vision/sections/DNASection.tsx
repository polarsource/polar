import GoIcon from '@/components/Icons/frameworks/go'
import NodeJsIcon from '@/components/Icons/frameworks/nodejs'
import PhpIcon from '@/components/Icons/frameworks/php'
import PythonIcon from '@/components/Icons/frameworks/python'
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
          <Grid
            className="relative z-10 hidden grid-cols-2 text-xs md:grid md:grid-cols-4"
            items={[
              <span
                key="a"
                className="bg-polar-200 absolute bottom-2 right-2 flex h-full w-full flex-col items-center justify-center text-black md:bottom-4 md:right-4"
              >
                <NodeJsIcon />
              </span>,
              <span
                key="b"
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <PythonIcon />
              </span>,
              <span
                key="c"
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <GoIcon />
              </span>,
              <span
                key="c"
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <PhpIcon />
              </span>,
            ]}
          />
          <Grid
            className="hidden grid-cols-2 text-xs md:grid md:grid-cols-4 [&>*]:aspect-auto"
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
