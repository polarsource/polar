import { StaticImage } from '@/components/Image/StaticImage'
import { Apple, Framer, Google, Raycast } from '@/components/Landing/Logos'
import { Box } from '@polar-sh/orbit/Box'
import { buildMetadata } from '@/utils/metadata'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

export const metadata = buildMetadata({
  path: '/downloads',
  title: 'Downloads',
  description: 'Use Polar in a variety of different environments',
  keywords:
    'downloads, ios, android, raycast, framer, binaries, saas, digital products, platform, developer, open source, funding, open source, economy',
})

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
    href: 'https://play.google.com/store/apps/details?id=com.polarsource.Polar',
    target: '_blank',
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
    <Box
      flexDirection="column"
      marginHorizontal="auto"
      height="100%"
      minHeight="100vh"
      width="100%"
      maxWidth="72rem"
      rowGap={{ base: '2xl', md: '5xl' }}
    >
      <Box width="100%" flexDirection="column" alignItems="center" rowGap="2xl">
        <Box
          flexDirection="column"
          alignItems="center"
          rowGap="2xl"
          paddingVertical="3xl"
          textAlign="center"
          maxWidth={{ lg: '42rem' }}
        >
          <StaticImage
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
        </Box>
      </Box>
      <Box flexDirection="column" rowGap="2xl">
        <Box
          display="grid"
          gridTemplateColumns={{
            base: 'repeat(1, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
          }}
          gap="2xl"
        >
          <Box flexDirection="column" rowGap="s">
            <h3 className="text-2xl">Mobile Apps</h3>
            <p className="dark:text-polar-500 text-lg text-gray-500">
              Your business in the palm of your hand
            </p>
          </Box>
          {downloads.map((link) => (
            <Link
              key={link.title + link.description}
              className={twMerge(
                'dark:hover:bg-polar-900 dark:border-polar-700 flex w-full cursor-pointer flex-col gap-6 border border-gray-300 p-6 transition-colors duration-200 hover:bg-gray-100',
              )}
              href={link.href ?? '#'}
              target={link.target}
            >
              <Box flexDirection="row" alignItems="center" columnGap="l">
                <span>{link.icon}</span>
                {!link.href ? (
                  <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
                    Coming Soon
                  </span>
                ) : null}
              </Box>
              <Box flexDirection="column" gap="s">
                <h3 className="text-xl">{link.title}</h3>
                <p className="dark:text-polar-500 font-sm text-gray-500">
                  {link.description}
                </p>
              </Box>
            </Link>
          ))}
        </Box>
      </Box>
      <Box flexDirection="column" rowGap="2xl">
        <Box
          display="grid"
          gridTemplateColumns={{
            base: 'repeat(1, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
          }}
          gap="2xl"
        >
          <Box flexDirection="column" rowGap="s">
            <h3 className="text-2xl">Plugins</h3>
            <p className="dark:text-polar-500 text-lg text-gray-500">
              Polar integrated in your favourite apps
            </p>
          </Box>
          {plugins.map((link) => (
            <Link
              key={link.title + link.description}
              className="dark:hover:bg-polar-900 dark:border-polar-700 flex w-full cursor-pointer flex-col gap-6 border border-gray-300 p-6 transition-colors duration-200 hover:bg-gray-100"
              href={link.href}
              target="_blank"
            >
              <Box flexDirection="row" alignItems="center" columnGap="l">
                <span>{link.icon}</span>
                {!link.href ? (
                  <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
                    Coming Soon
                  </span>
                ) : null}
              </Box>
              <Box flexDirection="column" gap="s">
                <h3 className="text-xl">{link.title}</h3>
                <p className="dark:text-polar-500 font-sm text-gray-500">
                  {link.description}
                </p>
              </Box>
            </Link>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
