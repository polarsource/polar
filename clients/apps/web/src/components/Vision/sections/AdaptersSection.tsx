import { Grid } from '../Grid'
import { Link } from '../Link'
import { Section } from '../Section'

export const AdaptersSection = () => {
  return (
    <Section
      header={{ index: '02', name: 'Adapters' }}
      title="The best DX in the industry"
      context={
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
              <span className="bg-polar-200 absolute bottom-2 right-2 flex h-full w-full flex-col items-center justify-center text-black md:bottom-4 md:right-4">
                @polar-sh/nextjs
              </span>,
              <span>@polar-sh/astro</span>,
              <span>@polar-sh/remix</span>,
              <span>@polar-sh/fastify</span>,
              <span>@polar-sh/elysia</span>,
              <span>@polar-sh/hono</span>,
              <span>@polar-sh/deno</span>,
              <span>@polar-sh/sveltekit</span>,
              <span>@polar-sh/express</span>,
              <span>@polar-sh/nuxt</span>,
              <span>@polar-sh/tanstack</span>,
              <span>@polar-sh/koa</span>,
            ]}
          />
        </div>
      }
    >
      <p>
        Polar aims to be the simplest way to integrate payments into your
        software. This should be a breeze. That&apos;s why we restrict the code
        you need to a maximum of 7 lines.
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
