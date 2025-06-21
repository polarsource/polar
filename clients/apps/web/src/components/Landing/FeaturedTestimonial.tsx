import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Link from 'next/link'

type FeaturedTestimonialProps = {
  href: string
  name: string
  title: string
  avatarUrl: string
  quote: string
}

export const FeaturedTestimonial = ({
  href,
  name,
  title,
  avatarUrl,
  quote,
}: FeaturedTestimonialProps) => {
  return (
    <article className="relative flex flex-col items-center gap-y-12 rounded-2xl py-1.5 text-center outline-none transition-opacity focus-within:ring-[3px] focus-within:ring-blue-100 hover:opacity-80 md:text-sm dark:ring-offset-transparent dark:focus-within:border-blue-600 dark:focus-within:ring-blue-700/40">
      <div className="flex flex-col items-center gap-y-2">
        <span aria-hidden="true" className="text-6xl">
          ”
        </span>
        <h3 className="text-2xl !leading-relaxed md:text-4xl">{quote}</h3>
      </div>
      <div className="flex flex-col items-center gap-y-4">
        <Avatar name={name} className="size-16" avatar_url={avatarUrl} />
        <div className="flex flex-col">
          <span className="">{name}</span>
          <span className="dark:text-polar-500 text-gray-500">{title}</span>
        </div>
      </div>
      <Link
        href={href}
        target="_blank"
        className="absolute inset-0 outline-none"
      />
    </article>
  )
}
