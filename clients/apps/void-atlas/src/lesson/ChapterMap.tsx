import Link from 'next/link'

export type ChapterLink = { readonly slug: string; readonly title: string }

/** Every chapter in reading order, with the current one lit. */
export const ChapterMap = ({
  chapters,
  current,
}: {
  chapters: readonly ChapterLink[]
  current: string
}) => (
  <nav aria-label="Chapters" className="hidden flex-col gap-1 lg:flex">
    <span className="text-muted-foreground mb-2 font-mono text-xs tracking-wide uppercase">
      Chapters
    </span>
    {chapters.map((chapter, i) => {
      const active = chapter.slug === current
      return (
        <Link
          key={chapter.slug}
          href={`/${chapter.slug}`}
          aria-current={active ? 'page' : undefined}
          className={`flex items-center gap-3 py-0.5 text-sm transition-colors ${
            active
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="w-5 font-mono text-xs tabular-nums">
            {String(i).padStart(2, '0')}
          </span>
          <span>{chapter.title}</span>
        </Link>
      )
    })}
  </nav>
)
