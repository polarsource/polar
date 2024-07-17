import { AnimatedIconButton } from '@/components/Feed/Posts/Post'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useListArticles } from '@/hooks/queries'
import {
  ArrowForward,
  BiotechOutlined,
  EditNoteOutlined,
  EmojiPeople,
  ShortTextOutlined,
} from '@mui/icons-material'
import { Article, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { useRef } from 'react'
import { useHoverDirty } from 'react-use'

const postTemplates = (organization: Organization, hasNoPosts: boolean) =>
  [
    hasNoPosts
      ? {
          title: 'Hello World',
          description:
            "Introduce yourself and your projects. Let people know who you are & what you're working on.",
          icon: (
            <EmojiPeople
              fontSize="large"
              className="text-blue-500 dark:text-blue-400"
            />
          ),
          link: `/maintainer/${organization.slug}/posts/new`,
        }
      : {
          title: 'TIL',
          description:
            "Share a few paragraphs on something you've learned recently. It could be a new tool, a new language, or a new concept.",
          icon: (
            <ShortTextOutlined
              fontSize="large"
              className="text-blue-500 dark:text-blue-400"
            />
          ),
          link: `/maintainer/${organization.slug}/posts/new`,
        },
    {
      title: 'Technical Deep-dive',
      description:
        "Proud of a project you've been working on? Share the details & secrets from under the hood.",
      icon: (
        <BiotechOutlined
          className="text-blue-500 dark:text-blue-400"
          fontSize="large"
        />
      ),
      link: `/maintainer/${organization.slug}/posts/new`,
    },
  ].slice(0, 2)

export const PostWizard = () => {
  const { org } = useCurrentOrgAndRepoFromURL()

  const { data: posts, isPending: articlesPending } = useListArticles({
    organizationId: org?.id,
    limit: 100,
  })

  const publishedPosts =
    posts?.pages[0].items?.filter((post) => !!post.published_at) ?? []

  const drafts =
    posts?.pages[0].items?.filter((post) => !post.published_at) ?? []

  if (!org || !org.feature_settings?.articles_enabled) return null

  return (
    <div className="flex grid-cols-2 flex-col gap-6 md:grid xl:grid-cols-3">
      <div className="col-span-2 flex flex-col gap-y-4 md:gap-y-6 md:py-6 lg:col-span-1">
        <EditNoteOutlined
          className="hidden text-blue-500 md:block dark:text-blue-400"
          fontSize="large"
        />
        <h2 className="text-2xl font-bold">Start Writing</h2>
        <p className="dark:text-polar-400 text-gray-600 [text-wrap:balance]">
          Build out an audience by writing posts and share it with your
          subscribers
        </p>
      </div>
      {!articlesPending && (
        <div className="col-span-2 flex flex-col gap-y-8">
          <div className="flex grid-cols-2 flex-col gap-8 md:grid">
            {postTemplates(org, publishedPosts.length < 1).map((template) => (
              <PostCard key={template.title} {...template} />
            ))}
          </div>
          {drafts.length > 0 && (
            <div className="col-span-2 flex flex-col gap-y-6">
              <h3 className="text-lg font-medium">
                {drafts.length} Unpublished
                {drafts.length === 1 ? ' Post' : ' Posts'}
              </h3>
              <List>
                {drafts.map((draft) => (
                  <ListItem key={draft.id}>
                    <DraftPost organization={org} draft={draft} />
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const PublicPagePostWizard = ({
  organization,
}: {
  organization: Organization
}) => {
  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      {postTemplates(organization, true).map((template) => (
        <PostCard key={template.title} {...template} />
      ))}
    </div>
  )
}

interface PostCardProps {
  title: string
  description: string
  icon: React.ReactNode
  link: string
}

const PostCard = ({ icon, title, description, link }: PostCardProps) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const isHovered = useHoverDirty(ref)

  return (
    <Link ref={ref} href={link}>
      <Card className="dark:hover:bg-polar-800 relative flex h-full flex-col transition-colors hover:bg-gray-50">
        <CardHeader className="gap-y-4 pb-4">
          {icon}
          <h3 className="text-2xl font-bold">{title}</h3>
        </CardHeader>
        <CardContent className="h-full">
          <p className="dark:text-polar-500 text-gray-500">{description}</p>
        </CardContent>
        <CardFooter>
          <AnimatedIconButton
            variant={isHovered ? 'default' : 'secondary'}
            active={isHovered}
          >
            <ArrowForward fontSize="inherit" />
          </AnimatedIconButton>
        </CardFooter>
      </Card>
    </Link>
  )
}

const DraftPost = ({
  organization,
  draft,
}: {
  organization: Organization
  draft: Article
}) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const isHovered = useHoverDirty(ref)

  return (
    <Link
      ref={ref}
      href={`/maintainer/${organization.slug}/posts/${draft.slug}`}
      className="flex w-full flex-row items-center justify-between"
    >
      <div className="flex flex-1 flex-col overflow-hidden">
        <h3 className="w-full truncate text-lg font-medium">{draft.title}</h3>
        <span className="dark:text-polar-500 text-sm capitalize text-gray-500">
          {draft.visibility}
        </span>
      </div>
      <AnimatedIconButton
        active={isHovered}
        variant={isHovered ? 'default' : 'secondary'}
      >
        <ArrowForward fontSize="inherit" />
      </AnimatedIconButton>
    </Link>
  )
}
