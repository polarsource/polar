import { Apple, Framer, Google, Raycast } from '@/components/Landing/Logos'
import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

export const metadata: Metadata = {
  title: 'Downloads',
  description: 'Use Polar in a variety of different environments',
  keywords:
    'downloads, ios, android, raycast, framer, binaries, saas, digital products, platform, developer, open source, funding, open source, economy',
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

const downloads = [
  {
    title: 'Polar for iOS',
    description: 'Your business in the palm of your hand. Built for iPhone.',
    href: 'https://apps.apple.com/se/app/polar-monetize-your-software/id6746640471',
    target: '_blank',
    icon: <Apple size={20} />,
  },
  {
    title: 'Polar for Android',
    description:
      'The perfect companion app for your business on Polar. Built for Android.',
    icon: <Google size={20} />,
  },
]

const plugins = [
  {
    title: 'Polar for Raycast',
    href: 'https://www.raycast.com/emilwidlund/polar',
    description:
      'Access to your latest orders & customers right at your fingertips.',
    icon: <Raycast size={20} />,
  },
  {
    title: 'Polar for Framer',
    href: 'https://www.framer.com/marketplace/plugins/polar',
    description:
      'Empower your Framer projects with flexible Checkout components.',
    icon: <Framer size={20} />,
  },
]

export default function Downloads() {
  return (
    <div className="mx-auto flex h-full min-h-screen w-full max-w-6xl flex-col gap-y-8 md:gap-y-24">
      <div className="flex w-full flex-col items-center gap-y-8">
        <div className="flex flex-col items-center gap-y-8 py-12 text-center lg:max-w-2xl">
          <Image
            className="rounded-3xl"
            src="/assets/brand/app-icon.png"
            width={160}
            height={160}
            alt="App Icon"
          />
          <h3 className="text-4xl md:text-7xl">Polar in your pocket</h3>
          <p className="dark:text-polar-500 text-2xl text-balance text-gray-500">
            Take Polar with you. Now available on a variety of platforms.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-y-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-2xl">Mobile Apps</h3>
            <p className="dark:text-polar-500 text-lg text-gray-500">
              Your business in the palm of your hand
            </p>
          </div>
          {downloads.map((link) => (
            <Link
              key={link.title + link.description}
              className={twMerge(
                'dark:hover:bg-polar-900 dark:border-polar-700 flex w-full cursor-pointer flex-col gap-6 border border-gray-300 p-6 transition-colors duration-200 hover:bg-gray-100',
              )}
              href={link.href ?? '#'}
              target={link.target}
            >
              <div className="flex flex-row items-center gap-x-4">
                <span>{link.icon}</span>
                {!link.href ? (
                  <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
                    Coming Soon
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl">{link.title}</h3>
                <p className="dark:text-polar-500 font-sm text-gray-500">
                  {link.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-y-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-2xl">Plugins</h3>
            <p className="dark:text-polar-500 text-lg text-gray-500">
              Polar integrated in your favourite apps
            </p>
          </div>
          {plugins.map((link) => (
            <Link
              key={link.title + link.description}
              className="dark:hover:bg-polar-900 dark:border-polar-700 flex w-full cursor-pointer flex-col gap-6 border border-gray-300 p-6 transition-colors duration-200 hover:bg-gray-100"
              href={link.href}
              target="_blank"
            >
              <div className="flex flex-row items-center gap-x-4">
                <span>{link.icon}</span>
                {!link.href ? (
                  <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
                    Coming Soon
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl">{link.title}</h3>
                <p className="dark:text-polar-500 font-sm text-gray-500">
                  {link.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
