import {
  Recommendation as FeedRecommendation,
  RecommendationType,
  RewardsRecommendation,
} from '../../data'
import { RewardsMeta } from './Rewards'

const metaResolver = (post: FeedRecommendation) => {
  switch (post.type) {
    case RecommendationType.Rewards:
      return <RewardsMeta {...(post as RewardsRecommendation)} />
    default:
      return null
  }
}

export const RecommendationMeta = (post: FeedRecommendation) => {
  const children = metaResolver(post)

  return children ? (
    <div className="flex w-full flex-col">{children}</div>
  ) : null
}
