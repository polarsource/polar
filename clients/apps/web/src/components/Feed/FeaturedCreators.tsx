import { useAuth } from '@/hooks'
import { AddOutlined } from '@mui/icons-material'
import { Platforms, SubscriptionTierType } from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  useCreateFreeSubscription,
  useListAdminOrganizations,
  useSubscriptionTiers,
  useUserSubscriptions,
} from 'polarkit/hooks'
import { MouseEventHandler, useCallback, useMemo } from 'react'

type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

const featuredCreators = [
  {
    name: 'davidhewitt',
    avatarUrl: 'https://avatars.githubusercontent.com/u/1939362?v=4',
    bio: `Uniting Python & Rust. Core maintainer of PyO3. Full-stack developer; other than Rust you'll find me using Python and Typescript.`,
  },
  {
    name: 'Kludex',
    avatarUrl: 'https://avatars.githubusercontent.com/u/7353520?v=4',
    bio: 'Software Engineer @ Pydantic, Uvicorn & Starlette maintainer & FastAPI Expert',
  },
  {
    name: 'emilwidlund',
    avatarUrl: 'https://avatars.githubusercontent.com/u/10053249?v=4',
    bio: 'Creative Technologist / WebGL, RxJS, React & Typescript / Previously design & code at EA',
  },
  {
    name: 'Sparckles',
    avatarUrl: 'https://avatars.githubusercontent.com/u/123258275?v=4',
    bio: 'An innovative open-source organization dedicated to extending the Web',
  },
  {
    name: 'eval',
    avatarUrl: 'https://avatars.githubusercontent.com/u/290596?v=4',
    bio: 'Ruby and Clojure consultant and OSS enthusiast',
  },
  {
    name: 'fief-dev',
    avatarUrl: 'https://avatars.githubusercontent.com/u/97037414?v=4',
    bio: 'Users and authentication management SaaS',
  },
  {
    name: 'isaacharrisholt',
    avatarUrl: 'https://avatars.githubusercontent.com/u/47423046?v=4',
    bio: 'Technology journalist and content creator. Avid Pythonista and hopefully future billionaire.',
  },
]

export const FeaturedCreators = () => {
  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <h3>Highlighted Creators</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Handpicked creators from the Polar community
        </p>
      </div>
      <div className="divide-y-gray-75 flex flex-col">
        {featuredCreators.map((creator) => (
          <FeaturedCreator key={creator.name} creator={creator} />
        ))}
      </div>
    </div>
  )
}

const FeaturedCreator = ({
  creator,
}: {
  creator: ArrayElement<typeof featuredCreators>
}) => {
  const { currentUser } = useAuth()
  const adminOrgs = useListAdminOrganizations()

  const { data } = useUserSubscriptions(
    currentUser?.id,
    creator.name,
    10,
    Platforms.GITHUB,
  )
  const subscription = data && data.items && data.items[0]
  const isSubscribed = subscription !== undefined

  const createFreeSubscription = useCreateFreeSubscription()

  const { data: { items: subscriptionTiers } = { items: [] } } =
    useSubscriptionTiers(creator.name, 100)

  const freeSubscriptionTier = useMemo(
    () =>
      subscriptionTiers?.find(
        (tier) => tier.type === SubscriptionTierType.FREE,
      ),
    [subscriptionTiers],
  )

  const canSubscribe = useMemo(
    () => adminOrgs.data?.items?.every((org) => org.name !== creator.name),
    [adminOrgs, creator],
  )

  const onSubscribeFree: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (e) => {
      if (!freeSubscriptionTier) return

      e.stopPropagation()

      await createFreeSubscription.mutateAsync({
        tier_id: freeSubscriptionTier.id,
      })
    },
    [createFreeSubscription, freeSubscriptionTier],
  )

  return (
    <div className="group flex flex-row items-start justify-between gap-x-4 py-4">
      <Link
        className="flex flex-row items-start gap-x-4"
        href={`/${creator.name}`}
      >
        <Avatar
          className="h-10 w-10 border-transparent transition-colors duration-200 group-hover:border-blue-200 dark:group-hover:border-blue-400"
          avatar_url={creator.avatarUrl}
          name={creator.name}
        />
        <div className="flex flex-col gap-y-1">
          <span className="text-sm">{creator.name}</span>
          <p className="dark:text-polar-500 text-xs text-gray-500">
            {creator.bio}
          </p>
        </div>
      </Link>
      {!isSubscribed && freeSubscriptionTier && canSubscribe && (
        <Button
          size="sm"
          className="h-8 w-8"
          variant="secondary"
          onClick={onSubscribeFree}
        >
          <AddOutlined fontSize="inherit" />
        </Button>
      )}
    </div>
  )
}
