'use client'

import dynamic from 'next/dynamic'

const TeamCarousel = dynamic(
  () => import('./TeamCarousel').then((m) => m.TeamCarousel),
  { ssr: false, loading: () => <div className="h-64 w-full md:h-84" /> },
)

export function TeamCarouselWrapper() {
  return <TeamCarousel />
}
