import type { Metadata } from 'next'

const DEFAULT_OG_IMAGE = 'https://polar.sh/assets/brand/polar_og.jpg'

interface BuildMetadataParams {
  path: string
  title?: string
  description?: string
  keywords?: string
  image?: string
  type?: 'website' | 'article'
  publishedTime?: string
}

export function buildMetadata({
  path,
  title,
  description,
  keywords,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  publishedTime,
}: BuildMetadataParams): Metadata {
  const images = [{ url: image, width: 1200, height: 630 }]

  const openGraph: Metadata['openGraph'] =
    type === 'article'
      ? {
          siteName: 'Polar',
          type: 'article',
          title,
          description,
          images,
          ...(publishedTime ? { publishedTime } : {}),
        }
      : {
          siteName: 'Polar',
          type: 'website',
          title,
          description,
          images,
        }

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ ...images[0], alt: title ?? 'Polar' }],
    },
  }
}
