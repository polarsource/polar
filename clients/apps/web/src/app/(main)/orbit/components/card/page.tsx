import {
  Box,
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
    <Stack gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Card"
        description={
          <>
            A surface for grouping related content. Composed of three optional
            sub-components —{' '}
            <Text as="code" fontFamily="mono" fontSize="sm">CardHeader</Text>,{' '}
            <Text as="code" fontFamily="mono" fontSize="sm">CardContent</Text>, and{' '}
            <Text as="code" fontFamily="mono" fontSize="sm">CardFooter</Text> — each
            separated by a dividing border.
          </>
        }
      />

      {/* Demos */}
      <Stack gap={4}>
        <OrbitSectionHeader title="Variants" />

        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          {/* Full */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Stack className="col-span-2 gap-1">
              <Headline as="h6" text="Full" />
              <Text as="span" variant="subtle" fontSize="xs">
                Header + Content + Footer
              </Text>
            </Stack>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Card title" />
                </CardHeader>
                <CardContent>
                  <Text variant="subtle" fontSize="sm" leading="relaxed">
                    This is the main body of the card. Use it for any content —
                    text, form fields, data, or other components.
                  </Text>
                </CardContent>
                <CardFooter>
                  <Text as="span" variant="subtle" fontSize="xs">
                    Footer metadata or actions
                  </Text>
                </CardFooter>
              </Card>
            </Box>
          </Box>

          {/* No footer */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Stack className="col-span-2 gap-1">
              <Headline as="h6" text="Header + Content" />
            </Stack>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Card title" />
                </CardHeader>
                <CardContent>
                  <Text variant="subtle" fontSize="sm" leading="relaxed">
                    A card without a footer — the most common pattern for
                    informational surfaces.
                  </Text>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Content only */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Stack className="col-span-2 gap-1">
              <Headline as="h6" text="Content only" />
            </Stack>
            <Box className="col-span-3">
              <Card>
                <CardContent>
                  <Text variant="subtle" fontSize="sm" leading="relaxed">
                    Just the surface. Useful as a highlight box or when the
                    content itself provides the structure.
                  </Text>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Composed */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Stack className="col-span-2 gap-1">
              <Headline as="h6" text="Composed" />
              <Text as="span" variant="subtle" fontSize="xs">
                With richer content
              </Text>
            </Stack>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Stack horizontal alignItems="center" justifyContent="between">
                    <Headline as="h5" text="Monthly Revenue" />
                    <Text as="span" variant="subtle" fontSize="xs">
                      Feb 2026
                    </Text>
                  </Stack>
                </CardHeader>
                <CardContent>
                  <Headline as="h2" text="$12,480" />
                  <Text variant="subtle" fontSize="xs" className="mt-1">
                    +18% from last month
                  </Text>
                </CardContent>
                <CardFooter>
                  <Text as="span" variant="subtle" fontSize="xs">
                    Updated just now
                  </Text>
                </CardFooter>
              </Card>
            </Box>
          </Box>
        </Stack>
      </Stack>

      {/* With actions */}
      <Stack gap={4}>
        <OrbitSectionHeader title="With actions" />

        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          {/* Single primary action in footer */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Stack className="col-span-2 gap-1">
              <Headline as="h6" text="Primary action" />
              <Text as="span" variant="subtle" fontSize="xs">
                Footer with a single CTA
              </Text>
            </Stack>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Upgrade your plan" />
                </CardHeader>
                <CardContent>
                  <Text variant="subtle" fontSize="sm" leading="relaxed">
                    Get access to unlimited projects, priority support, and
                    advanced analytics.
                  </Text>
                </CardContent>
                <CardFooter actions={[{ children: 'Upgrade now' }]} />
              </Card>
            </Box>
          </Box>

          {/* Primary + secondary */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Stack className="col-span-2 gap-1">
              <Headline as="h6" text="Primary + secondary" />
              <Text as="span" variant="subtle" fontSize="xs">
                Confirm / cancel pattern
              </Text>
            </Stack>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Delete organization" />
                </CardHeader>
                <CardContent>
                  <Text variant="subtle" fontSize="sm" leading="relaxed">
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
            </Box>
          </Box>

          {/* Action in header */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Stack className="col-span-2 gap-1">
              <Headline as="h6" text="Action in header" />
              <Text as="span" variant="subtle" fontSize="xs">
                Secondary action alongside title
              </Text>
            </Stack>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Stack horizontal alignItems="center" justifyContent="between">
                    <Headline as="h5" text="API Keys" />
                    <Button size="sm" variant="secondary">
                      New key
                    </Button>
                  </Stack>
                </CardHeader>
                <CardContent>
                  <Text variant="subtle" fontSize="sm" leading="relaxed">
                    Manage your personal API keys. Keys are shown only once at
                    creation time.
                  </Text>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Full: header action + footer actions */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Stack className="col-span-2 gap-1">
              <Headline as="h6" text="Full composition" />
              <Text as="span" variant="subtle" fontSize="xs">
                Actions in both header and footer
              </Text>
            </Stack>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Stack horizontal alignItems="center" justifyContent="between">
                    <Headline as="h5" text="Billing" />
                    <Button size="sm" variant="ghost">
                      View history
                    </Button>
                  </Stack>
                </CardHeader>
                <CardContent>
                  <Stack gap={1}>
                    <Headline as="h3" text="$49 / mo" />
                    <Text variant="subtle" fontSize="sm">
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
            </Box>
          </Box>
        </Stack>
      </Stack>

      {/* API */}
      <Stack gap={4}>
        <OrbitSectionHeader title="API" />
        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          {[
            {
              name: 'Card',
              props: 'children, className, padding, gap',
              desc: 'Root container. bg-surface background, lg radius. padding and gap accept OrbitSpacing keys (default: 3, 2).',
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
            <Box key={name} className="grid grid-cols-5 gap-4 py-4">
              <Text as="code" fontFamily="mono" fontSize="sm">
                {name}
              </Text>
              <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs" className="col-span-2">
                {props}
              </Text>
              <Text variant="subtle" fontSize="xs" className="col-span-2">
                {desc}
              </Text>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Stack>
  )
}
