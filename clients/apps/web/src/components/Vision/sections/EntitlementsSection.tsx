import { Console } from '../Console'
import { Grid } from '../Grid'
import { Section } from '../Section'

export const EntitlementsSection = () => {
  return (
    <Section
      header={{ index: '02', name: 'Automated Entitlements' }}
      title="Going for features vs. settling for flags."
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
                  Custom &amp; OSS Entitlement Strategies
                </span>,
                <span key="a">License Keys</span>,
                <span key="b">Digital Downloads</span>,
                <span key="c">GitHub & Discord Access</span>,
                <span key="e">Credits</span>,
              ]}
            />
          </div>

          <Console
            className="text-xs"
            code={`import { Webhooks, Entitlements, EntitlementStrategy } from '@polar-sh/nextjs';
import { WebClient } from '@slack/web-api';

const slackClient = new WebClient(process.env.SLACK_TOKEN);

const SlackEntitlement = new EntitlementStrategy()
  .grant(async ({ customer: { email } }) => slackClient.admin.users.invite({ email }))
  .revoke(async ctx => slackClient.admin.users.remove(...));

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
  entitlements: Entitlements.use('slack', SlackEntitlement)
});
`}
          />
        </div>
      }
    >
      <p>
        We&apos;ve built an entitlement engine going beyond mere flags to automate
        granting, revoking and delivering the features themselves depending on billing lifecycles.
      </p>
      <ul>
        <li>- License Keys</li>
        <li>- Digital Downloads</li>
        <li>- GitHub & Discord Access</li>
        <li>- Credits (Soon)</li>
      </ul>
      <strong>Next: Open Source Entitlement Strategies</strong>
      <p>
        Inspired by Passport.js, we&apos;re building our SDK/adapters to design for a rich suite
        of entitlement strategies to cherry-pick and npm, pip or gem install from.
      </p>
    </Section>
  )
}
