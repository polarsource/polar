import { createMember } from '@/actions'
import { Surface } from '@/components/Card'
import { PoBotLogo } from '@/components/PoBotLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { CreditBar } from '@/components/CreditBar'
import { db } from '@/db'
import { members } from '@/db/schema'
import { ORG, credits } from '@/void'
import { Avatar, Button, Grid, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

/** Pick who you are. The org's pool is shared; each member has their own cap on it. */
export default async function Home() {
  const rows = await db.select().from(members)
  const [org, ...each] = await Promise.all([
    credits(ORG),
    ...rows.map((member) => credits(member.id)),
  ])

  return (
    <Box
      as="main"
      flexDirection="column"
      rowGap="2xl"
      width="100%"
      maxWidth={720}
      marginHorizontal="auto"
      paddingHorizontal="xl"
      paddingVertical="4xl"
    >
      <Box as="header" alignItems="center" justifyContent="between">
        <PoBotLogo />
        <ThemeToggle />
      </Box>

      <Box as="section" flexDirection="column" rowGap="m">
        <Text variant="heading-xs" as="h1">
          Acme
        </Text>
        <Text color="muted">
          One organization on the Po Bot Team plan. Every member and every agent
          spends from this pool.
        </Text>
        <CreditBar credits={org} limit={org.credits} />
      </Box>

      <Box as="section" flexDirection="column" rowGap="m">
        <Text variant="label" color="muted" as="h2">
          Select member
        </Text>
        {rows.length === 0 && (
          <Text color="muted">No members yet. Add the first one below.</Text>
        )}
        <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }} gap="m">
          {rows.map((member, i) => (
            <Link
              key={member.id}
              href={`/members/${member.id}`}
              style={{ display: 'contents' }}
            >
              <Surface
                flexDirection="column"
                rowGap="m"
                padding="l"
                cursor="pointer"
                transitionProperty="all"
                transitionDuration="fast"
                boxShadow={{ base: 's', hover: 'm' }}
              >
                <Box alignItems="center" columnGap="m">
                  <Avatar
                    name={member.name}
                    avatar_url={null}
                    className="h-9 w-9 text-sm"
                  />
                  <Text variant="label" as="span">
                    {member.name}
                  </Text>
                </Box>
                <CreditBar credits={each[i]} limit={member.cap} />
              </Surface>
            </Link>
          ))}
        </Grid>
      </Box>

      <Box as="section" flexDirection="column" rowGap="m">
        <Text variant="label" color="muted" as="h2">
          Add member
        </Text>
        <Box as="form" action={createMember} alignItems="end" columnGap="s">
          <Box
            as="label"
            display="flex"
            flexDirection="column"
            rowGap="xs"
            flex={1}
          >
            <Text variant="caption" color="muted" as="span">
              Name
            </Text>
            <Input name="name" placeholder="Ada" required />
          </Box>
          <Box
            as="label"
            display="flex"
            flexDirection="column"
            rowGap="xs"
            width={160}
          >
            <Text variant="caption" color="muted" as="span">
              Credit cap per month
            </Text>
            <Input
              name="cap"
              type="number"
              min={1}
              defaultValue={10_000}
              required
            />
          </Box>
          <Button type="submit">Add member</Button>
        </Box>
      </Box>
    </Box>
  )
}
