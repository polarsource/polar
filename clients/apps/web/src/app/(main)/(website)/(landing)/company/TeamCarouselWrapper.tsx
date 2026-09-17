'use client'

import dynamic from 'next/dynamic'

const TeamFlipbook = dynamic(
  () => import('./TeamFlipbook').then((m) => m.TeamFlipbook),
  {
    ssr: false,
    loading: () => <div className="aspect-[3/2] w-full" />,
  },
)

export function TeamCarouselWrapper() {
  return <TeamFlipbook />
}
