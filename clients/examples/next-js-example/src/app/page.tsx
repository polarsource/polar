import { getServerSideAPI } from '@/utils/api'
import { Platforms } from '@polar-sh/sdk'
import Markdown from 'react-markdown'

export default async function Home() {
  const polar = getServerSideAPI()

  const [org, subscriptionTiers, articles] = await Promise.all([
    polar.organizations.lookup({
      organizationName: 'emilwidlund',
      platform: Platforms.GITHUB,
    }),
    polar.subscriptions.searchSubscriptionTiers({
      organizationName: 'emilwidlund',
      platform: Platforms.GITHUB,
    }),
    polar.articles.search({
      organizationName: 'emilwidlund',
      platform: Platforms.GITHUB,
    }),
  ])

  return (
    <main className="flex flex-col items-center gap-y-16 py-16">
      <div className="flex w-full max-w-2xl flex-row items-center gap-x-8">
        <div
          className="h-32 w-32 flex-shrink-0 rounded-full bg-cover bg-center"
          style={{ backgroundImage: `url(${org.avatar_url})` }}
        />
        <div className="flex flex-col gap-y-2">
          <h1 className="text-balance text-3xl font-bold leading-normal">
            {org.pretty_name}
          </h1>
          <p className="text-balance text-slate-500">{org.bio}</p>
        </div>
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-y-6">
        <div className="flex flex-col gap-y-6 rounded-3xl bg-slate-100 p-8">
          <span className="font-mono text-xs text-slate-400">README.md</span>
          <p className="text-pretty text-sm leading-normal text-slate-500">
            {`I'm Emil, a Creative Technologist who loves to play around with
            WebGL and reactive frameworks like RxJS. If you like what I'm up to,
            please consider subscribing to my Newsletter, or the paid
            subscriptions down below.`}
          </p>
          <div className="flex flex-row gap-x-4">
            <input
              className="w-full rounded-full bg-slate-200 px-4 text-sm placeholder-slate-400 focus:outline-none"
              type="email"
              placeholder="Enter your email..."
            />
            <button className="rounded-full border-none bg-blue-600 px-4 py-2 text-xs text-white transition-colors hover:bg-blue-500">
              Subscribe
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {subscriptionTiers.items
            ?.filter(({ type }) => type !== 'free')
            .slice(0, 3)
            .map((tier) => (
              <div
                key={tier.id}
                className="flex w-full flex-col gap-y-4 rounded-3xl bg-slate-100 p-6"
              >
                <div className="flex flex-row items-baseline justify-between">
                  <h3 className="font-semibold">{tier.name}</h3>
                  <h3 className="text-lg text-blue-600">
                    ${tier.prices[0].price_amount / 100}
                  </h3>
                </div>
                <p className="h-full text-sm text-slate-400">
                  {tier.description}
                </p>
                <button className="self-start rounded-full border-none bg-blue-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-blue-500">
                  Subscribe
                </button>
              </div>
            ))}
        </div>
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-y-16">
        {articles.items?.map((article) => (
          <a
            key={article.id}
            href={`/${article.slug}`}
            className="flex w-full max-w-2xl flex-col gap-y-4 transition-opacity duration-200 ease-in-out hover:opacity-60"
          >
            <h3 className="text-balance text-4xl font-bold leading-normal">
              {article.title}
            </h3>
            <p className="text-slate-500">
              {new Date(article.published_at ?? '').toLocaleDateString(
                'en-US',
                {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                },
              )}
            </p>
            <Markdown className="prose prose-a:text-blue-600 prose-a:no-underline prose-img:rounded-3xl prose-headings:leading-normal w-full">
              {article.body.split('\n\n')[0]}
            </Markdown>
          </a>
        ))}
      </div>
    </main>
  )
}
