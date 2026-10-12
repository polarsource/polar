'use client'

import { Controls } from './Controls'
import { Key } from './Keys'
import { Plate } from './Plate'
import { pieces } from './pages'
import type { Chapter as ChapterContent } from './content'

const byId = new Map(pieces.map((p) => [p.id, p]))

/** A chapter on the page: its number and title, a paragraph, a tip, its control, and its plates in order. */
export function Chapter({ chapter }: { chapter: ChapterContent }) {
  const home = chapter.n === '00'
  const plate = (id: string, i: number) => {
    const p = byId.get(id)
    if (!p) return null
    return <Plate key={id} piece={p} pace={home && i === 0 ? 2.4 : 1} />
  }
  return (
    <section
      data-chapter={chapter.n}
      className="flex flex-col gap-10 pt-6 pb-28"
    >
      {home ? plate(chapter.ids[0], 0) : null}
      {home ? null : (
        <div className="flex max-w-[520px] flex-col gap-5">
          <h1 className="m-0 text-[22px] leading-[1.3] font-medium">
            {chapter.n} {chapter.title}
          </h1>
          {chapter.intro ? (
            <p className="m-0 text-[13px] leading-[1.5]">{chapter.intro}</p>
          ) : null}
          {chapter.tip ? (
            <p className="m-0 text-[13px] leading-[1.5] text-[#7b7b7b]">
              Tip: {chapter.tip[0]} <Key>{chapter.tip[1]}</Key> {chapter.tip[2]}
            </p>
          ) : null}
          {chapter.control ? <Controls kind={chapter.control} /> : null}
        </div>
      )}
      {chapter.ids.map((id, i) => (home && i === 0 ? null : plate(id, i)))}
    </section>
  )
}
