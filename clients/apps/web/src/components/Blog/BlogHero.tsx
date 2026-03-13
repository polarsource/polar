interface BlogHeroProps {
  title: string
  description?: string
  publishDate?: string
}

export function BlogHero({ title, description, publishDate }: BlogHeroProps) {
  return (
    <section className="not-prose flex flex-col gap-8 pb-12 text-center md:px-4">
      <h1 className="font-display leading-tighter max-w-5xl text-4xl font-medium text-pretty md:text-7xl">
        {title}
      </h1>
      {description && (
        <p className="max-w-2xl text-xl text-balance">{description}</p>
      )}
      {publishDate && (
        <p className="dark:text-polar-500 text-gray-500">
          {new Date(publishDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
    </section>
  )
}
