import { Headline } from '@/components/Orbit'
import { OrbitPageHeader } from '../OrbitPageHeader'

const sections = [
  {
    title: 'Motion',
    subsections: [
      {
        heading: 'Easing',
        content:
          'Orbit uses a symmetric cubic bezier for all expressive transitions: cubic-bezier(0.7, 0, 0.3, 1). The sharp initial acceleration creates energy; the mirrored deceleration creates grace. This easing is non-negotiable for structural animations.',
      },
      {
        heading: 'Duration',
        content:
          'Headline reveals run at 1.7s — long enough to feel cinematic. Background scale animations (BarChart) use 1.4s. Opacity fades use 0.4s. Reserve longer durations for structural changes; shorter for overlays and state feedback.',
      },
      {
        heading: 'Stagger',
        content:
          'When animating sequences, use a stagger budget of 0.2s divided by the number of elements. This keeps total stagger time constant regardless of item count — two items stagger at 100ms each, ten items at 20ms each.',
      },
      {
        heading: 'Reduced Motion',
        content:
          'All animated components must respect the prefers-reduced-motion media query. Degrade gracefully to instant state changes — never disable functionality, only motion.',
      },
    ],
  },
  {
    title: 'Typography',
    subsections: [
      {
        heading: 'Hierarchy',
        content:
          'Use one heading level per section. h1 is reserved for page-level titles. h2 for major sections. h3 for subsections. h4–h6 for labels and supporting content. Never skip levels, and never use heading tags for visual weight alone.',
      },
      {
        heading: 'Tracking',
        content:
          'All headings use tracking-tighter (−0.04em letter-spacing). This is a fixed rule — it is part of Orbit\'s typographic identity. Body text uses default tracking. Never apply tight tracking to body copy or labels.',
      },
      {
        heading: 'Ligatures',
        content:
          'Standard ligatures are disabled on all Headline instances (liga 0). OpenType alternates ss07, ss08, and tabular zero are enabled for visual consistency across the display typeface.',
      },
      {
        heading: 'Line Length',
        content:
          'Body text should be constrained to 60–75 characters per line for readability. Use max-w-prose or equivalent. Headings can be allowed to run wider, especially at display sizes.',
      },
    ],
  },
  {
    title: 'Color',
    subsections: [
      {
        heading: 'Neutral First',
        content:
          'Orbit defaults to a neutral palette — black, white, and grays. Color is reserved for semantic use: destructive actions use red, interactive elements use blue. Never use color decoratively.',
      },
      {
        heading: 'Dark Mode',
        content:
          'Every surface and token must have a dark mode counterpart. Never use pure black (#000000) or pure white (#ffffff) directly — use the defined lightness range (10–85% in dark mode, 8–90% in light) so there is always some ambient depth.',
      },
      {
        heading: 'Contrast',
        content:
          'Maintain a minimum 4.5:1 contrast ratio for all text. Dynamic surfaces (such as BarChart bars) must switch text color at a defined lightness threshold. Orbit uses 45% lightness as the flip point between white and near-black text.',
      },
    ],
  },
  {
    title: 'Spacing',
    subsections: [
      {
        heading: '8px Grid',
        content:
          'All layout spacing follows a base-8 grid. Use multiples of 8px — 8, 16, 24, 32, 48, 64, 96, 128. Avoid arbitrary values. When Tailwind spacing utilities are insufficient, use a CSS calc expression rooted in 8px.',
      },
      {
        heading: 'Density',
        content:
          'Component interiors use 16px padding as a standard. Dense contexts (data tables, code blocks) may use 8px. Generous contexts (hero sections, editorial layouts) use 32–64px. Never mix density levels within a single component.',
      },
      {
        heading: 'Vertical Rhythm',
        content:
          'Section gaps in full-page layouts use 64px on mobile and 128px on desktop. Component-level gaps use 32px. Within a component, use 8–16px. This three-tier rhythm keeps layouts legible across all screen sizes.',
      },
    ],
  },
  {
    title: 'Accessibility',
    subsections: [
      {
        heading: 'Focus Visible',
        content:
          'Never suppress :focus-visible. Orbit components include ring-based focus indicators that appear only during keyboard navigation. Do not use outline: none without a replacement focus style.',
      },
      {
        heading: 'Touch Targets',
        content:
          'Interactive elements must have a minimum touch target of 44×44px. The sm Button size (32px height) falls below this — always ensure adequate surrounding padding or avoid it in primary mobile touch contexts.',
      },
      {
        heading: 'Semantic Markup',
        content:
          'Use the correct HTML element for the job. Headline renders actual h1–h6 elements, not styled divs. Buttons are always <button> or <a> — never a div with an onClick. Screen readers depend on semantic structure.',
      },
    ],
  },
]

export default function GuidelinesPage() {
  return (
    <div className="flex flex-col gap-20">
      <OrbitPageHeader
        title="Guidelines"
        description="Principles and rules for how Orbit components behave, and how to use them effectively in product contexts."
      />

      {sections.map(({ title, subsections }) => (
        <div key={title} className="flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <Headline as="h3" text={title} />
            <div className="dark:border-polar-800 border-t border-neutral-200" />
          </div>
          <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
            {subsections.map(({ heading, content }) => (
              <div key={heading} className="grid grid-cols-5 gap-8 py-6">
                <div className="col-span-2">
                  <Headline as="h6" text={heading} />
                </div>
                <p className="dark:text-polar-400 col-span-3 text-sm leading-relaxed text-neutral-600">
                  {content}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
