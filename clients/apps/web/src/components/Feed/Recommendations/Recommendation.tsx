'use client'

import { useRef } from 'react'
import { Recommendation as FeedRecommendation } from '../data'
import { RecommendationMeta } from './meta/Meta'

export const Recommendation = (props: FeedRecommendation) => {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      className={
        'dark:bg-polar-900 dark:border-polar-800 relative my-4 flex w-full flex-row justify-start gap-x-4 rounded-3xl border border-gray-100 bg-white shadow-sm transition-all duration-100'
      }
    >
      <RecommendationBody {...props} />
    </div>
  )
}

const RecommendationBody = (props: FeedRecommendation) => {
  return (
    <div
      className={
        'dark:text-polar-300 flex w-full flex-col gap-y-4 text-[15px] leading-relaxed text-gray-800 transition-colors duration-200'
      }
    >
      <RecommendationMeta {...props} />
    </div>
  )
}
