'use client'

import { Contents } from './Contents'
import { Cover } from './Cover'
import { Plate } from './Plate'
import { StreamVideo } from '@/components/Shared/StreamVideo'
import { pieces } from './pages'
import { chapterKey, type Chapter as ChapterContent } from './content'

const FIELD_GUIDE_VIDEO_ID = 'dd150505f55955403f2e2dd190771af7'
const byId = new Map(pieces.map((p) => [p.id, p]))

/** A chapter on the page: its number and title, a paragraph, and its plates in order. */
export function Chapter({ chapter }: { chapter: ChapterContent }) {
  const home = !chapter.n
  const plate = (id: string) => {
    const p = byId.get(id)
    if (!p) return null
    return <Plate key={id} piece={p} pace={1.3} />
  }
  return (
    <section
      data-chapter={chapterKey(chapter)}
      className="flex flex-col gap-32 pt-6 pb-56"
    >
      {home ? <Cover /> : null}
      {home ? <Contents /> : null}
      {home ? <StreamVideo videoId={FIELD_GUIDE_VIDEO_ID} controls /> : null}
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
      {chapter.ids.map((id, i) => (home && i === 0 ? null : plate(id)))}
    </section>
  )
}
