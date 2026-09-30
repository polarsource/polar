import { IntegratePage } from '@/components/Landing/integrate/IntegratePage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Integrate Polar',
  description:
    'Integrate Polar with the TypeScript and Python SDKs, the REST API, the CLI or the MCP server. One billing stack, whichever surface you work from.',
  keywords:
    'polar sdk, polar api, polar cli, polar mcp, billing api, usage billing sdk, webhooks',
  openGraph: {
    siteName: 'Polar',
    type: 'website',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
        alt: 'Polar',
      },
    ],
  },
}

export default function Page() {
  return <IntegratePage />
}
