'use client'

import dynamic from 'next/dynamic'

const TeamCarousel = dynamic(
  () => import('./TeamCarousel').then((m) => m.TeamCarousel),
  { ssr: false, loading: () => <div className="h-36 w-full md:h-[336px]" /> },
)

export function TeamCarouselWrapper() {
  return <TeamCarousel />
}
