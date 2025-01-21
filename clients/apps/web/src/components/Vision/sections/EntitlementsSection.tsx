import { Console } from '../Console'
import { Grid } from '../Grid'
import { Link } from '../Link'
import { Section } from '../Section'

export const EntitlementsSection = () => {
  return (
    <Section
      header={{ index: '02', name: 'Automated Entitlements' }}
      title="Connect entitlements to your SaaS products"
      context={
        <div className="flex flex-col gap-y-12 md:max-w-screen-md">
          <div className="relative flex">
            <div
              className="absolute left-2 top-2 z-0 flex h-full w-full flex-col items-center justify-center text-black md:left-4 md:top-4"
              style={{
                background:
                  'repeating-linear-gradient(-45deg, transparent 0px, transparent 9px, hsl(233, 8%, 24%) 9px, hsl(233, 8%, 24%) 10px)',
              }}
            />
            <Grid
              className="relative z-10 grid-cols-2 text-xs md:grid-cols-5 [&>*]:aspect-auto"
              items={[
                <span
                  key="d"
                  className="bg-polar-200 absolute bottom-2 right-2 flex h-full w-full flex-col items-center justify-center px-4 text-black md:bottom-4 md:right-4"
                >
                  Custom Entitlements
                </span>,
                <span key="a">License Keys</span>,
                <span key="b">Digital Downloads</span>,
                <span key="c">GitHub Repository Access</span>,
                <span key="e">Discord Server Invites</span>,
              ]}
            />
          </div>

          <Console
            className="text-xs"
            code={`import { Webhooks, Entitlements, EntitlementStrategy } from '@polar-sh/nextjs';

// Custom Entitlement which can grant or revoke access to anything
const mySaaSEntitlement = new EntitlementStrategy()
  .grant(async ctx => myservice.grant(...))
  .revoke(async ctx => myservice.revoke(...));

export const POST = Webhooks({
  webhookSecret: process.env.WEBHOOK_SECRET,
  entitlements: Entitlements.use('my-saas', mySaaSEntitlement)
});
`}
          />
        </div>
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
