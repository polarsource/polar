interface BlogHeroProps {
  title: string
  description?: string
}

export function BlogHero({ title, description }: BlogHeroProps) {
  return (
    <section className="not-prose flex flex-col gap-6 pb-12 text-center md:px-4">
      <h1 className="font-display leading-tighter max-w-5xl text-4xl font-medium text-pretty md:text-7xl">
        {title}
      </h1>
      {description && (
        <p className="max-w-2xl text-xl text-balance">{description}</p>
      )}
    </section>
  )
}
