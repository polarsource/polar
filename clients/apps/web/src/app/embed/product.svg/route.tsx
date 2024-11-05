import { ProductCard } from '@/components/Embed/ProductCard'
import { getServerURL } from '@/utils/api'
import {
  Product,
} from '@polar-sh/sdk'
const { default: satori } = require('satori')

export const runtime = 'edge'

const getProduct = async (
  productId: string,
  productPriceId: string,
): Promise<Product | undefined> => {
  let url = getServerURL(`/v1/products/${productId}`)
  const response = await fetch(url, {
    method: 'GET',
  })
  const d = (await response.json()) as Product
  if (!d) {
    return undefined
  }

  const filteredPrices = d.prices.filter((price) => {
    return (price.id === productPriceId)
  })

  if (!filteredPrices.length) {
    return undefined
  }

  d.prices = filteredPrices
  return d
}

const render = async (
  product: Product,
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
    <ProductCard
      product={product}
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const productId = searchParams.get('productId')
  if (!productId) {
    return generate404Response()
  }

  const productPriceId = searchParams.get('productPriceId')
  if (!productPriceId) {
    return generate404Response()
  }

  const darkmode = searchParams.has('darkmode')
  const cta = searchParams.get('cta')

  try {
    const product = await getProduct(productId, productPriceId)
    if (!product) {
      return generate404Response()
    }

    const svg = await render(
      product,
      cta,
      darkmode,
    )

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
      },
      status: 200,
    })
  } catch (error) {
    console.error(error)
    // Return 1x1 pixel SVG to prevent image-not-found issues in browsers
    return generate404Response()
  }
}
