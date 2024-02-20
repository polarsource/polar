import { getServerSideAPI } from '@/utils/api'
import { Platforms } from '@polar-sh/sdk'
import Markdown from 'react-markdown'

export default async function Post({
  params: { slug },
}: {
  params: { slug: string }
}) {
  const polar = getServerSideAPI()

  const article = await polar.articles.lookup({
    slug: slug,
    organizationName: 'emilwidlund',
    platform: Platforms.GITHUB,
  })

  if (!article) return null

  return (
    <main className="flex flex-col items-center gap-y-24 py-16">
      <article className="flex w-full max-w-2xl flex-col gap-y-4">
        <h3 className="text-balance text-4xl font-bold leading-normal">
          {article.title}
        </h3>
        <p className="text-slate-500">
          {new Date(article.published_at ?? '').toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <Markdown className="prose prose-a:text-blue-600 prose-a:no-underline prose-img:rounded-3xl prose-headings:leading-normal">
          {article.body}
        </Markdown>
      </article>
    </main>
  )
}
