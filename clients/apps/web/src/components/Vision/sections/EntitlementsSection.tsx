import { Console } from '../Console'
import { Grid } from '../Grid'
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
        Building SaaS products is all about granting and revoking access to your
        customers. With Polar Entitlements, we want to offer a best-in-class API
        to manage your customers&apos; access to anything.
      </p>
      <ul>
        <li>- License Keys</li>
        <li>- Digital Downloads</li>
        <li>- GitHub & Discord Access</li>
        <li>- Credits</li>
        <li>- Custom Entitlements</li>
      </ul>
      <p>
        We want to encourage our community to build custom entitlements that can
        be used with ease. Want to grant access to a Slack channel when a
        customer purchases something? There would be a Slack Entitlement
        Strategy for that.
      </p>
    </Section>
  )
}
