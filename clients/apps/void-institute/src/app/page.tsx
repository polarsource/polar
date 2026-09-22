import { ThemeToggle } from '@/components/ThemeToggle'
import { lessons, planned } from '@/content'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-16">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Void Institute
          </p>
          <h1 className="text-xl font-medium">
            How Void works, one step at a time.
          </h1>
          <p className="text-muted-foreground max-w-md text-[15px] leading-6">
            Each chapter builds one config file and shows what happens when it
            runs. Use the arrow keys to move.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <ol className="bg-card border-border divide-border flex flex-col divide-y overflow-hidden rounded-2xl border">
        {lessons.map((lesson, i) => (
          <li key={lesson.slug}>
            <Link
              href={`/${lesson.slug}`}
              className="group hover:bg-muted flex items-center gap-5 px-6 py-5 transition-colors"
            >
              <span className="text-muted-foreground w-5 font-mono text-xs tabular-nums">
                {String(i).padStart(2, '0')}
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{lesson.title}</span>
                <span className="text-muted-foreground text-sm">
                  {lesson.summary}
                </span>
              </span>
              <span className="text-muted-foreground mr-1 font-mono text-xs">
                {lesson.steps.length} steps
              </span>
              <ArrowRight
                size={16}
                className="text-muted-foreground group-hover:text-foreground transition-colors"
              />
            </Link>
          </li>
        ))}
        {planned.map((chapter, i) => (
          <li
            key={chapter.slug}
            className="flex items-center gap-5 px-6 py-5 opacity-60"
          >
            <span className="text-muted-foreground w-5 font-mono text-xs tabular-nums">
              {String(lessons.length + i).padStart(2, '0')}
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-medium">{chapter.title}</span>
              <span className="text-muted-foreground text-sm">
                {chapter.summary}
              </span>
            </span>
            <span className="text-muted-foreground font-mono text-xs">
              soon
            </span>
          </li>
        ))}
      </ol>
    </main>
  )
}
