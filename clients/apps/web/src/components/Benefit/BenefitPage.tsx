import { useGrantsForBenefit } from '@/hooks/queries/benefits'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  parseSearchParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import { Avatar } from '@polar-sh/orbit'
import { Button } from '@polar-sh/orbit'
import { DataTable } from '@polar-sh/orbit'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ColumnDef } from '@tanstack/react-table'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { BenefitGrantMemberBadge } from './BenefitGrantMemberBadge'
import { BenefitGrantStatus } from './BenefitGrantStatus'
import BenefitGrantStatusSelect, {
  BenefitGrantStatusFilter,
} from './BenefitGrantStatusSelect'

export interface BenefitPageProps {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}

export const BenefitPage = ({ benefit, organization }: BenefitPageProps) => {
  const searchParamsMap = useSearchParams()
  const searchParams = Object.fromEntries(searchParamsMap.entries())
  const { pagination, sorting } = parseSearchParams(searchParams)
  const grantStatus = (searchParams['grant_status'] ??
    'any') as BenefitGrantStatusFilter

  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    grantStatus: BenefitGrantStatusFilter,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    if (grantStatus !== 'any') {
      params.append('grant_status', grantStatus)
    }
    return params
  }

  const router = useRouter()

  const { data: benefitGrants, isLoading } = useGrantsForBenefit({
    benefitId: benefit.id,
    organizationId: organization.id,
    ...getAPIParams(pagination, sorting),
    // The backend only exposes an `is_granted` boolean filter. `is_granted=false`
    // actually matches all non-granted rows — revoked, pending, and errored — so
    // the "Revoked" option may include pending/errored grants in rare cases.
    ...(grantStatus !== 'any' ? { isGranted: grantStatus === 'granted' } : {}),
  })

  const memberColumnEnabled =
    !!organization.feature_settings?.member_model_enabled

  const setPagination = (
    updaterOrValue:
      | DataTablePaginationState
      | ((old: DataTablePaginationState) => DataTablePaginationState),
  ) => {
    const updatedPagination =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(pagination)
        : updaterOrValue

    router.push(
      `/dashboard/${organization.slug}/products/benefits/${benefit.id}?${getSearchParams(
        updatedPagination,
        sorting,
        grantStatus,
      )}`,
    )
  }

  const setSorting = (
    updaterOrValue:
      | DataTableSortingState
      | ((old: DataTableSortingState) => DataTableSortingState),
  ) => {
    const updatedSorting =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting)
        : updaterOrValue

    router.push(
      `/dashboard/${organization.slug}/products/benefits/${benefit.id}?${getSearchParams(
        pagination,
        updatedSorting,
        grantStatus,
      )}`,
    )
  }

  const setGrantStatus = (status: BenefitGrantStatusFilter) => {
    router.push(
      `/dashboard/${organization.slug}/products/benefits/${benefit.id}?${getSearchParams(
        pagination,
        sorting,
        status,
      )}`,
    )
  }

  const columns: ColumnDef<schemas['BenefitGrant']>[] = useMemo(() => {
    const cols: ColumnDef<schemas['BenefitGrant']>[] = [
      {
        accessorKey: 'customer',
        header: 'Customer',
        cell: ({ row: { original: grant } }) => (
          <Link
            href={`/dashboard/${organization.slug}/customers/${grant.customer.id}`}
          >
            <Box alignItems="center" gap="m">
              <Avatar
                className="h-10 w-10"
                avatar_url={grant.customer.avatar_url}
                name={grant.customer.email ?? grant.customer.name ?? '—'}
              />
              <Box minWidth={0} flexDirection="column">
                <Text truncate>{grant.customer.name ?? '—'}</Text>
                <Text variant="caption" color="muted" truncate>
                  {grant.customer.email ?? '—'}
                </Text>
              </Box>
            </Box>
          </Link>
        ),
      },
    ]

    if (memberColumnEnabled) {
      cols.push({
        accessorKey: 'member',
        header: 'Member',
        cell: ({ row: { original: grant } }) => (
          <BenefitGrantMemberBadge member={grant.member} />
        ),
      })
    }

    cols.push(
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row: { original: grant } }) => (
          <BenefitGrantStatus grant={grant} />
        ),
      },
      ...(benefit.type === 'slack_shared_channel'
        ? [
            {
              id: 'slack_channel',
              header: 'Slack',
              cell: ({ row: { original: grant } }) => (
                <SlackGrantDetails grant={grant} />
              ),
            } satisfies ColumnDef<schemas['BenefitGrant']>,
          ]
        : []),
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row: { original: grant } }) => (
          <FormattedDateTime datetime={grant.created_at} />
        ),
      },
      {
        accessorKey: 'order',
        header: 'Order',
        cell: ({ row: { original: grant } }) => {
          const hasOrder = grant.order_id
          const hasSubscription = grant.subscription_id

          if (!hasOrder && !hasSubscription) {
            return null
          }

          return (
            <Box gap="s">
              {hasOrder && (
                <Link
                  href={`/dashboard/${organization.slug}/sales/${grant.order_id}`}
                >
                  <Button size="sm" variant="secondary">
                    View Order
                  </Button>
                </Link>
              )}
              {hasSubscription && (
                <Link
                  href={`/dashboard/${organization.slug}/sales/subscriptions/${grant.subscription_id}`}
                >
                  <Button size="sm" variant="secondary">
                    View Subscription
                  </Button>
                </Link>
              )}
            </Box>
          )
        },
      },
    )

    return cols
  }, [benefit.type, memberColumnEnabled, organization.slug])

  return (
    <Box flexDirection="column" gap="xl">
      <Box alignItems="center" justifyContent="between" gap="l">
        <Text variant="heading-xxs" as="h2">
          Benefit Grants
        </Text>
        <Box width="auto">
          <BenefitGrantStatusSelect
            statuses={['granted', 'revoked']}
            value={grantStatus}
            onChange={setGrantStatus}
          />
        </Box>
      </Box>
      <DataTable
        data={benefitGrants?.items || []}
        isLoading={isLoading}
        sorting={sorting}
        onSortingChange={setSorting}
        pagination={pagination}
        rowCount={benefitGrants?.pagination.total_count ?? 0}
        pageCount={benefitGrants?.pagination.max_page ?? 1}
        onPaginationChange={setPagination}
        columns={columns}
      />
    </Box>
  )
}

const SlackGrantDetails = ({ grant }: { grant: schemas['BenefitGrant'] }) => {
  const properties =
    grant.properties as schemas['BenefitGrantSlackSharedChannelProperties']
  const status = properties.connected_team_id
    ? 'Connected'
    : properties.invite_url
      ? 'Invite pending'
      : properties.invited_email
        ? 'Provisioning'
        : 'Waiting for email'

  return (
    <Box minWidth={0} flexDirection="column" gap="s">
      <Box minWidth={0} flexDirection="column">
        <Text monospace truncate>
          {properties.channel_name ? `#${properties.channel_name}` : '—'}
        </Text>
        <Text variant="caption" color="muted" truncate>
          {status}
          {properties.invited_email ? ` · ${properties.invited_email}` : ''}
        </Text>
      </Box>
      {properties.invite_url && (
        <a
          href={properties.invite_url}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start"
        >
          <Button size="sm" variant="secondary">
            <ExternalLink className="h-3 w-3" />
            Open invite
          </Button>
        </a>
      )}
    </Box>
  )
}
