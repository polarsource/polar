import { useLiveCatalog } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PublishDraftButton } from './PublishDraftButton'

export const DraftVersionBanner = ({
  organization,
  draftId,
  currentHref,
}: {
  organization: schemas['Organization']
  draftId: string
  currentHref: string | null
}) => {
  const router = useRouter()
  const { data: liveCatalog } = useLiveCatalog(organization.id, true)

  return (
    <Box
      flexDirection={{ base: 'column', md: 'row' }}
      alignItems={{ base: 'start', md: 'center' }}
      justifyContent="between"
      columnGap="2xl"
      rowGap="l"
      paddingVertical="l"
      paddingHorizontal="xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box flexDirection="column" rowGap="xs" minWidth={0}>
        <Text variant="title">You&apos;re viewing a draft</Text>
        <Text color="muted">
          This version isn&apos;t published yet. New checkouts use{' '}
          {liveCatalog ? (
            <Link
              href={`/dashboard/${organization.slug}/products/versions/${liveCatalog.id}`}
              className="hover:underline"
            >
              <Text as="span" color="default">
                {liveCatalog.name ?? 'the current version'}
              </Text>
            </Link>
          ) : (
            'the current version'
          )}{' '}
          until it is.
        </Text>
      </Box>
      <Box
        alignItems="center"
        flexWrap="wrap"
        columnGap="m"
        rowGap="m"
        flexShrink={0}
      >
        <Button
          variant="secondary"
          onClick={() =>
            router.push(
              `/dashboard/${organization.slug}/products/versions/${draftId}`,
            )
          }
        >
          View changes
        </Button>
        {currentHref ? (
          <Button variant="secondary" onClick={() => router.push(currentHref)}>
            View current version
          </Button>
        ) : null}
        <PublishDraftButton catalogId={draftId} />
      </Box>
    </Box>
  )
}
