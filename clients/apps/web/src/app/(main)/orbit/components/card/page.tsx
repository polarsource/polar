import {
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
    <div className="flex flex-col gap-20">
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
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader title="Variants" />

        <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
          {/* Full */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <div className="col-span-2 flex flex-col gap-1">
              <Headline as="h6" text="Full" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Header + Content + Footer
              </span>
            </div>
            <div className="col-span-3">
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
            </div>
          </div>

          {/* No footer */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <div className="col-span-2 flex flex-col gap-1">
              <Headline as="h6" text="Header + Content" />
            </div>
            <div className="col-span-3">
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
            </div>
          </div>

          {/* Content only */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <div className="col-span-2 flex flex-col gap-1">
              <Headline as="h6" text="Content only" />
            </div>
            <div className="col-span-3">
              <Card>
                <CardContent>
                  <p className="dark:text-polar-400 text-sm leading-relaxed text-neutral-600">
                    Just the surface. Useful as a highlight box or when the
                    content itself provides the structure.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Composed */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <div className="col-span-2 flex flex-col gap-1">
              <Headline as="h6" text="Composed" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                With richer content
              </span>
            </div>
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Headline as="h5" text="Monthly Revenue" />
                    <span className="dark:text-polar-500 text-xs text-neutral-400">
                      Feb 2026
                    </span>
                  </div>
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
            </div>
          </div>
        </div>
      </div>

      {/* With actions */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader title="With actions" />

        <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
          {/* Single primary action in footer */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <div className="col-span-2 flex flex-col gap-1">
              <Headline as="h6" text="Primary action" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Footer with a single CTA
              </span>
            </div>
            <div className="col-span-3">
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
            </div>
          </div>

          {/* Primary + secondary */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <div className="col-span-2 flex flex-col gap-1">
              <Headline as="h6" text="Primary + secondary" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Confirm / cancel pattern
              </span>
            </div>
            <div className="col-span-3">
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
            </div>
          </div>

          {/* Action in header */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <div className="col-span-2 flex flex-col gap-1">
              <Headline as="h6" text="Action in header" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Secondary action alongside title
              </span>
            </div>
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Headline as="h5" text="API Keys" />
                    <Button size="sm" variant="secondary">
                      New key
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="dark:text-polar-400 text-sm leading-relaxed text-neutral-600">
                    Manage your personal API keys. Keys are shown only once at
                    creation time.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Full: header action + footer actions */}
          <div className="grid grid-cols-5 gap-8 py-8">
            <div className="col-span-2 flex flex-col gap-1">
              <Headline as="h6" text="Full composition" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Actions in both header and footer
              </span>
            </div>
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Headline as="h5" text="Billing" />
                    <Button size="sm" variant="ghost">
                      View history
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <Headline as="h3" text="$49 / mo" />
                    <p className="dark:text-polar-500 text-sm text-neutral-400">
                      Pro plan · renews Mar 1, 2026
                    </p>
                  </div>
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
        </div>
      </div>

      {/* API */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader title="API" />
        <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
          {[
            {
              name: 'Card',
              props: 'children, className',
              desc: 'Root container. Faint gray surface with a border.',
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
              <code className="dark:text-polar-200 font-mono text-sm text-neutral-800">
                {name}
              </code>
              <code className="dark:text-polar-400 col-span-2 font-mono text-xs text-neutral-500">
                {props}
              </code>
              <span className="dark:text-polar-400 col-span-2 text-xs text-neutral-500">
                {desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
