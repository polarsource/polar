import { StaticImage } from '@/components/Image/StaticImage'
import { ContentPost, getAllContent } from '@/utils/blog'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

function formatDate(dateStr: string) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const TYPE_LABEL: Record<ContentPost['type'], string> = {
  blog: 'Blog',
  story: 'Customer story',
}

const Cover = ({ post, sizes }: { post: ContentPost; sizes: string }) => (
  <Box
    position="relative"
    overflow="hidden"
    aspectRatio="16 / 9"
    backgroundColor="background-secondary"
  >
    {post.image ? (
      <StaticImage
        src={post.image}
        alt={post.title}
        fill
        className="object-cover"
        sizes={sizes}
        unoptimized
      />
    ) : null}
  </Box>
)

const Meta = ({ post }: { post: ContentPost }) => (
  <Box columnGap="s" alignItems="baseline">
    <Text variant="body" color="muted">
      {TYPE_LABEL[post.type]}
    </Text>
    {post.date ? (
      <>
        <Text variant="body" color="muted">
          ·
        </Text>
        <Text variant="body" color="muted">
          {formatDate(post.date)}
        </Text>
      </>
    ) : null}
  </Box>
)

const FeaturedPost = ({ post }: { post: ContentPost }) => (
  <Link href={post.href}>
    <Grid
      templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
      gap={{ base: 'xl', lg: 'l' }}
    >
      <Box flexDirection="column" justifyContent="end" rowGap="xl">
        <Box flexDirection="column" rowGap="s" maxWidth="32rem">
          <Text variant="heading-l" as="h2" wrap="pretty">
            {post.title}
          </Text>
          {post.description ? (
            <Box display="block">
              <Text variant="heading-s" color="muted" wrap="pretty">
                {post.description}
              </Text>
            </Box>
          ) : null}
        </Box>
        <Meta post={post} />
      </Box>
      <Cover post={post} sizes="(min-width: 1024px) 50vw, 100vw" />
    </Grid>
  </Link>
)

const PostCard = ({ post }: { post: ContentPost }) => (
  <Link href={post.href}>
    <Box flexDirection="column" rowGap="l">
      <Cover
        post={post}
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
      />
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3" wrap="balance">
          {post.title}
        </Text>
        <Meta post={post} />
      </Box>
    </Box>
  </Link>
)

export default function BlogPage() {
  const [featured, ...posts] = getAllContent()

  return (
    <Box width="100%" flexDirection="column">
      <Box
        as="section"
        width="100%"
        flexDirection="column"
        rowGap={{ base: '3xl', md: '4xl' }}
        paddingTop={{ base: 'm', md: '5xl' }}
        paddingBottom={{ base: '3xl', md: '5xl' }}
      >
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          gap={{ base: '2xl', lg: 'l' }}
        >
          <Box flexDirection="column" rowGap="s">
            <Text variant="heading-xl" as="h1">
              Blog
            </Text>
            <Text variant="heading-xl" as="p" color="muted" wrap="balance">
              Thinking out loud
            </Text>
          </Box>
        </Grid>
        {featured ? <FeaturedPost post={featured} /> : null}
      </Box>

      <Box
        as="section"
        width="100%"
        paddingVertical={{ base: '4xl', md: '5xl' }}
        marginVertical={{ base: 'none', md: '2xl' }}
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Grid
          templateColumns={{
            base: '1fr',
            md: 'repeat(2, 1fr)',
            xl: 'repeat(4, 1fr)',
          }}
          columnGap="l"
          rowGap={{ base: '3xl', xl: '4xl' }}
        >
          {posts.map((post) => (
            <PostCard key={`${post.type}-${post.slug}`} post={post} />
          ))}
        </Grid>
      </Box>
    </Box>
  )
}
