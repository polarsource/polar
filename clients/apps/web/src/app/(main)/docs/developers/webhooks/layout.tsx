import {
  DocumentationPageSidebar,
  MainNavigation,
  MobileNav,
  NavigationHeadline,
} from '@/components/Documentation/Navigation'
import { NavigationItem } from '@/components/Documentation/NavigationItem'
import { fetchSchema, getWebhooks } from '@/components/Documentation/openapi'
import { DataObjectOutlined } from '@mui/icons-material'
import { OpenAPIV3_1 } from 'openapi-types'

export const dynamic = 'force-static'
export const dynamicParams = false

const WEBHOOK_NAVIGATION_SELL = [
  'checkout',
  'order',
  'subscription',
  'benefit_grant',
]

const WEBHOOK_NAVIGATION_MANAGE = ['product', 'benefit', 'organization']

const WebhookEventNavigationItem = ({
  webhooks,
}: {
  webhooks: [string, OpenAPIV3_1.OperationObject][]
}) => {
  return (
    <>
      {webhooks.map(([event, _]) => (
        <NavigationItem
          key={event}
          href={`/docs/developers/webhooks/events/${event}`}
          icon={<DataObjectOutlined fontSize="inherit" />}
        >
          {event}
        </NavigationItem>
      ))}
    </>
  )
}

const WebhooksNavigation = ({
  webhooks,
}: {
  webhooks: [string, OpenAPIV3_1.OperationObject][]
}) => {
  let nav: { [prefix: string]: [string, OpenAPIV3_1.OperationObject][] } = {}
  webhooks.map(([event, webhook]) => {
    const prefix = event.split('.')[0]
    if (nav[prefix]) {
      nav[prefix].push([event, webhook])
    } else {
      nav[prefix] = [[event, webhook]]
    }
  })

  return (
    <div className="flex flex-col gap-y-6">
      <NavigationItem href="/docs/developers/webhooks">
        Configuration
      </NavigationItem>
      <div>
        <NavigationHeadline>Sales Events</NavigationHeadline>
        {WEBHOOK_NAVIGATION_SELL.map((prefix) => (
          <WebhookEventNavigationItem key={prefix} webhooks={nav[prefix]} />
        ))}
      </div>
      <div>
        <NavigationHeadline>Store Events</NavigationHeadline>
        {WEBHOOK_NAVIGATION_MANAGE.map((prefix) => (
          <WebhookEventNavigationItem key={prefix} webhooks={nav[prefix]} />
        ))}
      </div>
    </div>
  )
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const schema = await fetchSchema()
  const webhooks = getWebhooks(schema)

  return (
    <>
      <MobileNav activeSection="webhooks">
        <MainNavigation />
      </MobileNav>
      <DocumentationPageSidebar activeSection="webhooks">
        <WebhooksNavigation webhooks={webhooks} />
      </DocumentationPageSidebar>
      {children}
    </>
  )
}
