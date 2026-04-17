/**
 * LandingFooter — sparse, grid-divided footer with link columns
 * and a copyright line.
 */

const COLS = [
  {
    title: 'Product',
    links: ['Overview', 'Pricing', 'Changelog', 'Status'],
  },
  {
    title: 'Developers',
    links: ['Documentation', 'API Reference', 'SDKs', 'Examples'],
  },
  {
    title: 'Company',
    links: ['About', 'Blog', 'Careers', 'Contact'],
  },
  {
    title: 'Legal',
    links: ['Privacy', 'Terms', 'Security', 'DPA'],
  },
]

export const LandingFooter = () => (
  <footer className="border-b border-neutral-800">
    <div className="grid grid-cols-4 divide-x divide-neutral-800">
      {COLS.map((col) => (
        <div key={col.title} className="p-8 py-12">
          <div className="mb-6 text-base uppercase text-white">
            {col.title}
          </div>
          <ul className="flex flex-col gap-3">
            {col.links.map((link) => (
              <li key={link}>
                <a
                  href="#"
                  className="text-lg text-neutral-500 transition hover:text-white"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="flex items-center justify-between border-t border-neutral-800 px-8 py-5">
      <span className="text-base text-neutral-600">
        &copy; 2026 Polar Software Inc.
      </span>
      <span className="text-base text-neutral-600">
        polar.sh
      </span>
    </div>
  </footer>
)
