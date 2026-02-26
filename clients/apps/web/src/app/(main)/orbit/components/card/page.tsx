import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Headline,
  Stack,
  Text,
} from '@polar-sh/orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

export default function CardPage() {
  return (
    <Stack vertical gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Card"
        description={
          <>
            A surface for grouping related content. Composed of three optional
            sub-components —{' '}
            <Text as="code" variant="mono">
              CardHeader
            </Text>
            ,{' '}
            <Text as="code" variant="mono">
              CardContent
            </Text>
            , and{' '}
            <Text as="code" variant="mono">
              CardFooter
            </Text>{' '}
            — each separated by a dividing border.
          </>
        }
      />

      {/* Demos */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="Variants" />

        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {/* Full */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <Stack vertical className="col-span-2 gap-1">
              <Headline as="h6" text="Full" />
              <Text as="span" variant="caption">
                Header + Content + Footer
              </Text>
            </Stack>
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Card title" />
                </CardHeader>
                <CardContent>
                  <Text variant="subtle">
                    This is the main body of the card. Use it for any content —
                    text, form fields, data, or other components.
                  </Text>
                </CardContent>
                <CardFooter>
                  <Text as="span" variant="caption">
                    Footer metadata or actions
                  </Text>
                </CardFooter>
              </Card>
            </div>
          </div>

          {/* No footer */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <Stack vertical className="col-span-2 gap-1">
              <Headline as="h6" text="Header + Content" />
            </Stack>
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Card title" />
                </CardHeader>
                <CardContent>
                  <Text variant="subtle">
                    A card without a footer — the most common pattern for
                    informational surfaces.
                  </Text>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Content only */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <Stack vertical className="col-span-2 gap-1">
              <Headline as="h6" text="Content only" />
            </Stack>
            <div className="col-span-3">
              <Card>
                <CardContent>
                  <Text variant="subtle">
                    Just the surface. Useful as a highlight box or when the
                    content itself provides the structure.
                  </Text>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Composed */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <Stack vertical className="col-span-2 gap-1">
              <Headline as="h6" text="Composed" />
              <Text as="span" variant="caption">
                With richer content
              </Text>
            </Stack>
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <Stack alignItems="center" justifyContent="between">
                    <Headline as="h5" text="Monthly Revenue" />
                    <Text as="span" variant="caption">
                      Feb 2026
                    </Text>
                  </Stack>
                </CardHeader>
                <CardContent>
                  <Headline as="h2" text="$12,480" />
                  <Text variant="caption" className="mt-1">
                    +18% from last month
                  </Text>
                </CardContent>
                <CardFooter>
                  <Text as="span" variant="caption">
                    Updated just now
                  </Text>
                </CardFooter>
              </Card>
            </div>
          </div>
        </Stack>
      </Stack>

      {/* With actions */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="With actions" />

        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {/* Single primary action in footer */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <Stack vertical className="col-span-2 gap-1">
              <Headline as="h6" text="Primary action" />
              <Text as="span" variant="caption">
                Footer with a single CTA
              </Text>
            </Stack>
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Upgrade your plan" />
                </CardHeader>
                <CardContent>
                  <Text variant="subtle">
                    Get access to unlimited projects, priority support, and
                    advanced analytics.
                  </Text>
                </CardContent>
                <CardFooter actions={[{ children: 'Upgrade now' }]} />
              </Card>
            </div>
          </div>

          {/* Primary + secondary */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <Stack vertical className="col-span-2 gap-1">
              <Headline as="h6" text="Primary + secondary" />
              <Text as="span" variant="caption">
                Confirm / cancel pattern
              </Text>
            </Stack>
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Delete organization" />
                </CardHeader>
                <CardContent>
                  <Text variant="subtle">
                    This action cannot be undone. All data associated with this
                    organization will be permanently removed.
                  </Text>
                </CardContent>
                <CardFooter
                  actions={[
                    { children: 'Delete', variant: 'destructive' },
                    { children: 'Cancel', variant: 'ghost' },
                  ]}
                />
              </Card>
            </div>
          </div>

          {/* Action in header */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <Stack vertical className="col-span-2 gap-1">
              <Headline as="h6" text="Action in header" />
              <Text as="span" variant="caption">
                Secondary action alongside title
              </Text>
            </Stack>
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <Stack alignItems="center" justifyContent="between">
                    <Headline as="h5" text="API Keys" />
                    <Button size="sm" variant="secondary">
                      New key
                    </Button>
                  </Stack>
                </CardHeader>
                <CardContent>
                  <Text variant="subtle">
                    Manage your personal API keys. Keys are shown only once at
                    creation time.
                  </Text>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Full: header action + footer actions */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <Stack vertical className="col-span-2 gap-1">
              <Headline as="h6" text="Full composition" />
              <Text as="span" variant="caption">
                Actions in both header and footer
              </Text>
            </Stack>
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <Stack alignItems="center" justifyContent="between">
                    <Headline as="h5" text="Billing" />
                    <Button size="sm" variant="ghost">
                      View history
                    </Button>
                  </Stack>
                </CardHeader>
                <CardContent>
                  <Stack vertical gap={1}>
                    <Headline as="h3" text="$49 / mo" />
                    <Text variant="subtle">
                      Pro plan · renews Mar 1, 2026
                    </Text>
                  </Stack>
                </CardContent>
                <CardFooter
                  actions={[
                    { children: 'Change plan', variant: 'primary' },
                    { children: 'Cancel subscription', variant: 'ghost' },
                  ]}
                />
              </Card>
            </div>
          </div>
        </Stack>
      </Stack>

      {/* API */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="API" />
        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {[
            {
              name: 'Card',
              props: 'children, className, padding, gap',
              desc: 'Root container. BG_SURFACE background, lg radius. padding and gap accept OrbitSpacing keys (default: 3, 2).',
            },
            {
              name: 'CardHeader',
              props: 'children, className',
              desc: 'Top section. Adds bottom border and 16px vertical padding.',
            },
            {
              name: 'CardContent',
              props: 'children, className',
              desc: 'Main body. Grows to fill available space (flex-1).',
            },
            {
              name: 'CardFooter',
              props: 'children, className',
              desc: 'Bottom section. Adds top border and 16px vertical padding.',
            },
          ].map(({ name, props, desc }) => (
            <div key={name} className="grid grid-cols-5 gap-4 py-4">
              <Text as="code" variant="mono">
                {name}
              </Text>
              <Text
                as="code"
                variant="mono"
                className="col-span-2"
              >
                {props}
              </Text>
              <Text variant="caption" className="col-span-2">
                {desc}
              </Text>
            </div>
          ))}
        </Stack>
      </Stack>
    </Stack>
  )
}
