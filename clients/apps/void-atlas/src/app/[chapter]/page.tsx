import { lessons } from '@/content'
import { prepare } from '@/lesson/highlight'
import { Lesson } from '@/lesson/Lesson'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ chapter: string }>
  searchParams: Promise<{ step?: string }>
}

const find = (slug: string) => lessons.find((lesson) => lesson.slug === slug)

export const generateStaticParams = () =>
  lessons.map((lesson) => ({ chapter: lesson.slug }))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lesson = find((await params).chapter)
  return { title: lesson?.title ?? 'Not found' }
}

export default async function Chapter({ params, searchParams }: Props) {
  const lesson = find((await params).chapter)
  if (!lesson) notFound()
  const step = Number((await searchParams).step ?? '1')
  const steps = await prepare(lesson)
  const chapters = lessons.map(({ slug, title }) => ({ slug, title }))
  return (
    <Lesson
      slug={lesson.slug}
      title={lesson.title}
      chapters={chapters}
      steps={steps}
      initialStep={Number.isFinite(step) ? step - 1 : 0}
    />
  )
}
