'use client'

import { Contents } from './Contents'
import { Plate } from './Plate'
import { pieces } from './pages'
import type { Chapter as ChapterContent } from './content'

const byId = new Map(pieces.map((p) => [p.id, p]))

/** A chapter on the page: its number and title, a paragraph, and its plates in order. */
export function Chapter({ chapter }: { chapter: ChapterContent }) {
  const home = chapter.n === '00'
  const plate = (id: string, i: number) => {
    const p = byId.get(id)
    if (!p) return null
    return <Plate key={id} piece={p} pace={home && i === 0 ? 2.4 : 1.3} />
  }
  return (
    <section
      data-chapter={chapter.n}
      className="flex flex-col gap-32 pt-6 pb-56"
    >
      {home ? plate(chapter.ids[0], 0) : null}
      {home ? <Contents /> : null}
      {home ? null : (
        <div className="flex max-w-[600px] flex-col gap-5">
          <h1 className="m-0 text-[35px] leading-[1.15] font-medium tracking-[-0.01em] text-[#d8d8d8]">
            <span className="mr-4 text-[#7b7b7b]">{chapter.n}</span>
            {chapter.title}
          </h1>
          {chapter.intro ? (
            <p className="m-0 text-[20px] leading-[1.35] font-[450] text-[#7b7b7b]">
              {chapter.intro}
            </p>
          ) : null}
        </div>
      )}
      {chapter.ids.map((id, i) => (home && i === 0 ? null : plate(id, i)))}
    </section>
  )
}
