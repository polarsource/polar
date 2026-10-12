'use client'

import { CHAPTERS } from './content'
import { pieces } from './pages'

const titles = new Map(pieces.map((p) => [p.id, p.title]))

/**
 * The gutter to the left, two characters wide, as a terminal would draw it: the chapter's number where it
 * begins, a dash for every page in it, and a cursor on the page in view. A row says its name when the pointer
 * is over it, and a click goes there.
 */
export function Ruler({
  current,
  onChapter,
  onPage,
}: {
  current: string
  onChapter: (i: number) => void
  onPage: (id: string) => void
}) {
  const row = (
    key: string,
    label: string,
    glyph: string,
    tone: string,
    onClick: () => void,
    lit = false,
  ) => (
    <button
      key={key}
      type="button"
      aria-label={label}
      aria-current={lit ? 'true' : undefined}
      className={`group relative flex h-[14px] cursor-pointer items-center border-0 bg-transparent p-0 text-left font-mono text-[11px] leading-none transition-colors hover:text-[#d8d8d8] ${tone}`}
      onClick={onClick}
    >
      <span className="w-[2ch] whitespace-pre">{glyph}</span>
      <span className="pointer-events-none absolute inset-y-0 left-[3ch] z-10 hidden items-center bg-[#141414] whitespace-nowrap text-[#d8d8d8] group-hover:flex">
        {label}
      </span>
    </button>
  )
  return (
    <nav aria-label="Chapters and pages" className="flex flex-col">
      {CHAPTERS.map((c, i) => (
        <div key={c.n} className="flex flex-col">
          {row(c.n, c.name, c.n, 'text-[#7b7b7b]', () => onChapter(i))}
          {c.ids.map((id) => {
            const lit = id === current
            return row(
              id,
              titles.get(id) ?? id,
              lit ? '>' : '-',
              lit ? 'text-[#d8d8d8]' : 'text-[#3a3a3a]',
              () => onPage(id),
              lit,
            )
          })}
        </div>
      ))}
    </nav>
  )
}
