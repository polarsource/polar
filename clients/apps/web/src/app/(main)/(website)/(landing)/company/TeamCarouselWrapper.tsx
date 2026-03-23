'use client'

import dynamic from 'next/dynamic'

const TeamCarousel = dynamic(
  () => import('./TeamCarousel').then((m) => m.TeamCarousel),
  {
    ssr: false,
    loading: () => <div className="h-[115px] w-full md:h-[269px]" />,
  },
)

export function TeamCarouselWrapper() {
  return <TeamCarousel />
}
