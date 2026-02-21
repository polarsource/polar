import {
  Box,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Headline,
} from '@/components/Orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

export default function CardPage() {
  return (
    <Box display="flex" flexDirection="column" className="gap-20">
      <OrbitPageHeader
        label="Component"
        title="Card"
        description={
          <>
            A surface for grouping related content. Composed of three optional
            sub-components —{' '}
            <code className="font-mono text-sm">CardHeader</code>,{' '}
            <code className="font-mono text-sm">CardContent</code>, and{' '}
            <code className="font-mono text-sm">CardFooter</code> — each
            separated by a dividing border.
          </>
        }
      />

      {/* Demos */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Variants" />

        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {/* Full */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Box display="flex" flexDirection="column" className="col-span-2 gap-1">
              <Headline as="h6" text="Full" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Header + Content + Footer
              </span>
            </Box>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Card title" />
                </CardHeader>
                <CardContent>
                  <p className="dark:text-polar-400 text-sm leading-relaxed text-neutral-600">
                    This is the main body of the card. Use it for any content —
                    text, form fields, data, or other components.
                  </p>
                </CardContent>
                <CardFooter>
                  <span className="dark:text-polar-500 text-xs text-neutral-400">
                    Footer metadata or actions
                  </span>
                </CardFooter>
              </Card>
            </Box>
          </Box>

          {/* No footer */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Box display="flex" flexDirection="column" className="col-span-2 gap-1">
              <Headline as="h6" text="Header + Content" />
            </Box>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Card title" />
                </CardHeader>
                <CardContent>
                  <p className="dark:text-polar-400 text-sm leading-relaxed text-neutral-600">
                    A card without a footer — the most common pattern for
                    informational surfaces.
                  </p>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Content only */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Box display="flex" flexDirection="column" className="col-span-2 gap-1">
              <Headline as="h6" text="Content only" />
            </Box>
            <Box className="col-span-3">
              <Card>
                <CardContent>
                  <p className="dark:text-polar-400 text-sm leading-relaxed text-neutral-600">
                    Just the surface. Useful as a highlight box or when the
                    content itself provides the structure.
                  </p>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Composed */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Box display="flex" flexDirection="column" className="col-span-2 gap-1">
              <Headline as="h6" text="Composed" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                With richer content
              </span>
            </Box>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Box display="flex" alignItems="center" justifyContent="between">
                    <Headline as="h5" text="Monthly Revenue" />
                    <span className="dark:text-polar-500 text-xs text-neutral-400">
                      Feb 2026
                    </span>
                  </Box>
                </CardHeader>
                <CardContent>
                  <Headline as="h2" text="$12,480" />
                  <p className="dark:text-polar-500 mt-1 text-xs text-neutral-400">
                    +18% from last month
                  </p>
                </CardContent>
                <CardFooter>
                  <span className="dark:text-polar-500 text-xs text-neutral-400">
                    Updated just now
                  </span>
                </CardFooter>
              </Card>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* With actions */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="With actions" />

        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {/* Single primary action in footer */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Box display="flex" flexDirection="column" className="col-span-2 gap-1">
              <Headline as="h6" text="Primary action" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Footer with a single CTA
              </span>
            </Box>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Upgrade your plan" />
                </CardHeader>
                <CardContent>
                  <p className="dark:text-polar-400 text-sm leading-relaxed text-neutral-600">
                    Get access to unlimited projects, priority support, and
                    advanced analytics.
                  </p>
                </CardContent>
                <CardFooter actions={[{ children: 'Upgrade now' }]} />
              </Card>
            </Box>
          </Box>

          {/* Primary + secondary */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Box display="flex" flexDirection="column" className="col-span-2 gap-1">
              <Headline as="h6" text="Primary + secondary" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Confirm / cancel pattern
              </span>
            </Box>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Headline as="h5" text="Delete organization" />
                </CardHeader>
                <CardContent>
                  <p className="dark:text-polar-400 text-sm leading-relaxed text-neutral-600">
                    This action cannot be undone. All data associated with this
                    organization will be permanently removed.
                  </p>
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
            <Box display="flex" flexDirection="column" className="col-span-2 gap-1">
              <Headline as="h6" text="Action in header" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Secondary action alongside title
              </span>
            </Box>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Box display="flex" alignItems="center" justifyContent="between">
                    <Headline as="h5" text="API Keys" />
                    <Button size="sm" variant="secondary">
                      New key
                    </Button>
                  </Box>
                </CardHeader>
                <CardContent>
                  <p className="dark:text-polar-400 text-sm leading-relaxed text-neutral-600">
                    Manage your personal API keys. Keys are shown only once at
                    creation time.
                  </p>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Full: header action + footer actions */}
          <Box className="grid grid-cols-5 gap-8 py-8">
            <Box display="flex" flexDirection="column" className="col-span-2 gap-1">
              <Headline as="h6" text="Full composition" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Actions in both header and footer
              </span>
            </Box>
            <Box className="col-span-3">
              <Card>
                <CardHeader>
                  <Box display="flex" alignItems="center" justifyContent="between">
                    <Headline as="h5" text="Billing" />
                    <Button size="sm" variant="ghost">
                      View history
                    </Button>
                  </Box>
                </CardHeader>
                <CardContent>
                  <Box display="flex" flexDirection="column" gap={1}>
                    <Headline as="h3" text="$49 / mo" />
                    <p className="dark:text-polar-500 text-sm text-neutral-400">
                      Pro plan · renews Mar 1, 2026
                    </p>
                  </Box>
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
        </Box>
      </Box>

      {/* API */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="API" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
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
              <code className="dark:text-polar-200 font-mono text-sm text-neutral-800">
                {name}
              </code>
              <code className="dark:text-polar-400 col-span-2 font-mono text-xs text-neutral-500">
                {props}
              </code>
              <span className="dark:text-polar-400 col-span-2 text-xs text-neutral-500">
                {desc}
              </span>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
