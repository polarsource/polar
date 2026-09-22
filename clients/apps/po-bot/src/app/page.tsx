'use client'

import { CreditBar } from '@/components/CreditBar'
import { n } from '@/format'
import { Surface } from '@/components/Card'
import { PoBotLogo } from '@/components/PoBotLogo'
import { TopUp } from '@/components/TopUp'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LiveStream, useTree } from '@/hooks/live'
import { useCreateMember, useMembers } from '@/hooks/queries'
import { Avatar } from '@polar-sh/orbit/Avatar'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit/Button'
import { Grid } from '@polar-sh/orbit/Grid'
import { Input } from '@polar-sh/orbit/Input'
import { Text } from '@polar-sh/orbit/Text'
import Link from 'next/link'

/** Pick who you are. The org's pool is shared; each member has their own cap on it. */
export default function Home() {
  const rows = useMembers()
  const tree = useTree()
  const createMember = useCreateMember()
  const org = tree.org.standing

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name') ?? '').trim()
    const cap = Number(data.get('cap'))
    if (!name || !(cap > 0)) return
    createMember.mutate({ name, cap }, { onSuccess: () => form.reset() })
  }

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
      <LiveStream />
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
        {org.credits > 0 ? (
          <CreditBar credits={org} limit={org.credits} />
        ) : null}
        <Box justifyContent="between" alignItems="center" columnGap="m">
          {tree.org.signal.enterBelow > 0 ? (
            <Text
              variant="caption"
              color={tree.org.signal.status === 'active' ? 'danger' : 'muted'}
            >
              {tree.org.signal.status === 'unknown'
                ? `${tree.org.signal.signal} has not been read yet`
                : `${tree.org.signal.signal} is ${tree.org.signal.status}, ${n(tree.org.signal.remaining)} left`}
              . On below {n(tree.org.signal.enterBelow)}.
            </Text>
          ) : (
            <span />
          )}
          <TopUp />
        </Box>
      </Box>

      <Box as="section" flexDirection="column" rowGap="m">
        <Text variant="label" color="muted" as="h2">
          Select member
        </Text>
        {rows.length === 0 && (
          <Text color="muted">No members yet. Add the first one below.</Text>
        )}
        <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }} gap="m">
          {rows.map((member) => (
            <Link
              key={member.id}
              href={`/members/${member.id}`}
              style={{ color: 'inherit', textDecoration: 'none' }}
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
                <CreditBar credits={member.standing} limit={member.cap} />
              </Surface>
            </Link>
          ))}
        </Grid>
      </Box>

      <Box as="section" flexDirection="column" rowGap="m">
        <Text variant="label" color="muted" as="h2">
          Add member
        </Text>
        <Box as="form" onSubmit={onSubmit} alignItems="end" columnGap="s">
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
          <Button type="submit" loading={createMember.isPending}>
            Add member
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
