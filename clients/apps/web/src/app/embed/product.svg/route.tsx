import { ProductCardEmbed } from '@/components/Embed/ProductCardEmbed'
import { getServerURL } from '@/utils/api'
import {
  ProductEmbed,
} from '@polar-sh/sdk'
const { default: satori } = require('satori')

export const runtime = 'edge'

const generate304Response = () => {
  return new Response(
    null,
    {
      status: 304,
    },
  )
}

const generate404Response = () => {
  return new Response(
    '<svg width="1" height="1" viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg"></svg>',
    {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
      },
      status: 400,
    },
  )
}

const getEmbed = async (
  productId: string,
  productPriceId?: string,
  cachedEtag?: string,
): Promise<ProductEmbed | Response> => {
  let path = `/v1/embed/product/${productId}`
  if (productPriceId) {
    path += `?price_id=${productPriceId}`
  }
  let url = getServerURL(path)

  let headers: Record<string, string> = {}
  if (cachedEtag) {
    headers['If-None-Match'] = cachedEtag
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: headers
  })

  const useCache = response.status === 304
  if (useCache) {
    return generate304Response()
  }

  if (!useCache && !response.ok) {
    const body = await response.text()
    console.error(`HTTP ${response.status} /v1/embed/product: ${body}`)
    return generate404Response()
  }

  return (await response.json()) as ProductEmbed
}

const render = async (
  embed: ProductEmbed,
  cta?: string,
  darkmode?: boolean,
) => {
  const inter500 = await fetch(
    new URL('../../../assets/fonts/Inter-Regular.ttf', import.meta.url),
  ).then((res) => res.arrayBuffer())

  const inter600 = await fetch(
    new URL('../../../assets/fonts/Inter-Medium.ttf', import.meta.url),
  ).then((res) => res.arrayBuffer())

  return await satori(
    <ProductCardEmbed
      embed={embed}
      cta={cta}
      darkmode={darkmode}
    />,
    {
      fonts: [
        {
          name: 'Inter',
          data: inter500,
          weight: 500,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: inter600,
          weight: 600,
          style: 'medium',
        },
      ],
    },
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')
  if (!productId) {
    return generate404Response()
  }

  const cachedEtag = request.headers.get('If-None-Match') ?? undefined
  const productPriceId = searchParams.get('productPriceId') ?? undefined
  const darkmode = searchParams.has('darkmode')
  const cta = searchParams.get('cta') ?? undefined

  try {
    const embed = await getEmbed(productId, productPriceId, cachedEtag)
    if (embed instanceof Response) {
      return embed
    }

    // Sanity check before render
    if (!embed.price) {
      return generate404Response()
    }

    const svg = await render(
      embed,
      cta,
      darkmode,
    )

    const cacheTTL = 60 * 60 * 24 * 100  // 100 days
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': `public, max-age=${cacheTTL}`,
        'ETag': embed.etag,
      },
      status: 200,
    })
  } catch (error) {
    console.error(error)
    // Return 1x1 pixel SVG to prevent image-not-found issues in browsers
    return generate404Response()
  }
}
