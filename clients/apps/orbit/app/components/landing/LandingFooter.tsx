import { SectionHeading } from './SectionHeading'
import { SlicedPolar } from './SlicedPolar'

/**
 * LandingFooter — editorial footer with CTA heading, structured
 * link rows, oversized company name, and social links bar.
 */

const LINK_ROWS = [
  {
    label: 'Sitemap',
    links: ['Home', 'Product', 'Pricing', 'Changelog', 'Status'],
  },
  {
    label: 'Developers',
    links: ['Documentation', 'API Reference', 'SDKs', 'Examples'],
  },
  {
    label: 'Company',
    links: ['About', 'Blog', 'Careers', 'Contact'],
  },
]

const SOCIALS = ['GitHub', 'X', 'LinkedIn', 'Discord']

export const LandingFooter = () => (
  <footer className="mx-2 pb-2 text-neutral-900 dark:text-white">
    {/* Top — CTA heading + description */}
    <div className="grid grid-cols-1 px-12 pt-32 pb-20 md:grid-cols-2">
      <div>
        <SectionHeading className="text-[clamp(1.5rem,4.5vw,6rem)]! whitespace-nowrap">
          Polar Software, Inc.
        </SectionHeading>
        <SectionHeading className="dark:text-dark-500! text-[clamp(1.5rem,4.5vw,6rem)]! whitespace-nowrap text-neutral-300!">
          The billing company.
        </SectionHeading>
      </div>
      <div className="flex items-end">
        <p className="max-w-2xl text-4xl leading-snug">
          A small team with a clear mission — give every AI company the
          financial foundation to grow. By challenging the status quo.
        </p>
      </div>
    </div>

    {/* Link rows — 2-col grid, label on left half, links stacked on right half */}
    <div className="px-12">
      {LINK_ROWS.map((row) => (
        <div
          key={row.label}
          className="dark:border-dark-700 grid grid-cols-2 py-10"
        >
          <span className="text-4xl">{row.label}</span>
          <div className="flex flex-col gap-2">
            {row.links.map((link) => (
              <a
                key={link}
                href="#"
                className="dark:text-dark-200 text-4xl text-neutral-900 transition hover:text-neutral-500 dark:text-white"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* Bottom bar — socials left, copyright right */}
    <div className="flex items-center justify-between px-12 py-12">
      <div className="flex gap-8">
        {SOCIALS.map((s) => (
          <a
            key={s}
            href="#"
            className="dark:text-dark-300 text-base text-neutral-500 transition hover:text-neutral-900 dark:hover:text-white"
          >
            {s}
          </a>
        ))}
      </div>
      <span className="dark:text-dark-300 text-base text-neutral-400">
        &copy; 2026 Polar Software, Inc.
      </span>
    </div>
  </footer>
)
