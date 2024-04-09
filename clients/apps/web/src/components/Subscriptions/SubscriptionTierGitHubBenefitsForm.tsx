import { useAuth } from '@/hooks'
import { defaultApiUrl } from '@/utils/domain'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { RefreshOutlined } from '@mui/icons-material'
import {
  GitHubInvitesBenefitOrganization,
  GitHubInvitesBenefitRepository,
  OAuthPlatform,
  SubscriptionBenefitGitHubRepositoryCreate,
  SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum,
  SubscriptionBenefitType,
} from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'
import { getGitHubRepositoryBenefitAuthorizeURL } from 'polarkit/auth'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { Banner } from 'polarkit/components/ui/molecules'
import {
  useListIntegrationsGithubRepositoryBenefitUserRepositories,
  useSSE,
} from 'polarkit/hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'

interface GitHubRepositoryBenefitFormProps {
  update?: boolean
}

const GitHubRepositoryBenefitFormForDeprecatedPolarApp = () => {
  const {
    formState: { defaultValues },
  } = useFormContext<SubscriptionBenefitGitHubRepositoryCreate>()

  return (
    <>
      <Banner color={'muted'}>
        This benefit is using an older type of integration, and can no longer be
        updated.
      </Banner>

      <FormItem>
        <div className="flex flex-row items-center justify-between">
          <FormLabel>Organization</FormLabel>
        </div>
        <div className="flex items-center gap-2">
          <FormControl>
            <Select defaultValue="org" disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select a GitHub organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="org">
                  {defaultValues?.properties?.repository_owner ?? ''}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormControl>
        </div>
        <FormMessage />
      </FormItem>

      <FormItem>
        <div className="flex flex-row items-center justify-between">
          <FormLabel>Repository</FormLabel>
        </div>
        <div className="flex items-center gap-2">
          <FormControl>
            <Select defaultValue="repo" disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select a GitHub repository" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="repo">
                  {defaultValues?.properties?.repository_name ?? ''}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormControl>
        </div>
        <FormMessage />
      </FormItem>

      <FormItem>
        <div className="flex flex-row items-center justify-between">
          <FormLabel>Role</FormLabel>
        </div>
        <div className="flex items-center gap-2">
          <FormControl>
            <Select defaultValue="role" disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role">
                  {
                    {
                      [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.PULL]:
                        'Read',
                      [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.TRIAGE]:
                        'Triage',
                      [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.PUSH]:
                        'Write',
                      [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.MAINTAIN]:
                        'Maintain',
                      [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.ADMIN]:
                        'Admin',
                    }[
                      defaultValues?.properties?.permission ??
                        SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.PULL
                    ]
                  }
                </SelectItem>
              </SelectContent>
            </Select>
          </FormControl>
        </div>
        <FormMessage />
      </FormItem>
    </>
  )
}

export const GitHubRepositoryBenefitForm = ({
  update = false,
}: GitHubRepositoryBenefitFormProps) => {
  const {
    control,
    watch,
    formState: { defaultValues },
    setValue,
    setError,
    clearErrors,
  } = useFormContext<SubscriptionBenefitGitHubRepositoryCreate>()

  const canConfigurePersonalOrg = isFeatureEnabled(
    'github-benefit-personal-org',
  )

  const pathname = usePathname()

  const description = watch('description')

  const { currentUser } = useAuth()

  const {
    data: repositories,
    refetch: refetchRepositories,
    isFetching: isFetchingRepositories,
  } = useListIntegrationsGithubRepositoryBenefitUserRepositories()

  const userGitHubBenefitOauth = currentUser?.oauth_accounts.find(
    (o) => o.platform === OAuthPlatform.GITHUB_REPOSITORY_BENEFIT,
  )

  const [installationWindow, setInstallationWindow] = useState<Window | null>(
    null,
  )
  const openInstallationURL = useCallback(() => {
    const installationWindow = window.open(
      `${defaultApiUrl}/api/v1/integrations/github_repository_benefit/installation/install`,
      '_blank',
    )
    setInstallationWindow(installationWindow)
  }, [])

  const emitter = useSSE()

  useEffect(() => {
    const onAppInstalled = () => {
      if (installationWindow) {
        installationWindow.close()
        setInstallationWindow(null)
      }
      refetchRepositories()
    }

    emitter.on(
      'integrations.github_repository_benefit.installed',
      onAppInstalled,
    )
    return () => {
      emitter.off(
        'integrations.github_repository_benefit.installed',
        onAppInstalled,
      )
    }
  }, [emitter, installationWindow])

  type GitHubInvitesBenefitRepositoryWithKey =
    GitHubInvitesBenefitRepository & {
      org: GitHubInvitesBenefitOrganization | undefined
      key: string
    }

  const repos = useMemo(() => {
    return (repositories?.repositories ?? []).map((r) => {
      const org = repositories?.organizations.find(
        (o) => o.name === r.repository_owner,
      )

      return {
        ...r,
        org,
        key: r.repository_owner + '/' + r.repository_name,
      } as GitHubInvitesBenefitRepositoryWithKey
    })
  }, [repositories])

  const [selectedRepository, setSelectedRepository] = useState<
    GitHubInvitesBenefitRepositoryWithKey | undefined
  >()

  const onRepositoryChange = (key: string) => {
    const repo = repos.find((r) => r.key == key)
    setSelectedRepository(repo)
    setValue('properties.repository_owner', repo?.repository_owner)
    setValue('properties.repository_name', repo?.repository_name)
  }

  const formRepoOwner = watch('properties.repository_owner')

  useEffect(() => {
    const org = repositories?.organizations.find(
      (o) => o.name === formRepoOwner,
    )

    if (org?.is_personal && !canConfigurePersonalOrg) {
      setError('properties.repository_owner', {
        message:
          'For security reasons, we do not support configuring a repository on a personal organization.',
      })
    } else {
      clearErrors('properties.repository_owner')
    }
  }, [formRepoOwner, repositories, canConfigurePersonalOrg])

  // Set selected on load
  const didSetOnLoad = useRef(false)
  useEffect(() => {
    if (didSetOnLoad.current || isFetchingRepositories) {
      return
    }

    const props = defaultValues?.properties

    if (props && props.repository_owner && props.repository_name) {
      const key = `${props.repository_owner}/${props.repository_name}`
      const repo = repos.find((r) => r.key == key)
      if (repo) {
        didSetOnLoad.current = true
        onRepositoryChange(key)
      }
    }
  }, [repositories?.repositories, isFetchingRepositories])

  const authorizeURL = useMemo(() => {
    const searchParams = new URLSearchParams()
    if (!update) {
      searchParams.set('create_benefit', 'true')
      searchParams.set('type', SubscriptionBenefitType.GITHUB_REPOSITORY)
      searchParams.set('description', description)
    }
    const returnTo = `${pathname}?${searchParams}`
    return getGitHubRepositoryBenefitAuthorizeURL({ returnTo })
  }, [pathname, description])

  // Show configuration for deprecated integration setup
  // Does not allow edits
  if (defaultValues?.properties?.repository_id) {
    return <GitHubRepositoryBenefitFormForDeprecatedPolarApp />
  }

  if (!userGitHubBenefitOauth) {
    return (
      <>
        <Button asChild>
          <a href={authorizeURL} className="w-full text-center">
            Connect your GitHub Account
          </a>
        </Button>

        {update ? (
          <FormDescription>
            Connected to {defaultValues?.properties?.repository_owner}/
            {defaultValues?.properties?.repository_name}.
          </FormDescription>
        ) : null}
      </>
    )
  }

  return (
    <>
      <>
        <FormDescription>
          Connected as @{userGitHubBenefitOauth?.account_username}.{' '}
          <Button
            variant="link"
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              window.location.href = authorizeURL
            }}
            className="h-fit p-0"
          >
            Reconnect
          </Button>
        </FormDescription>
      </>

      <FormItem>
        <div className="flex flex-row items-center justify-between">
          <FormLabel>Repository</FormLabel>
        </div>
        <div className="flex items-center gap-2">
          {(update && selectedRepository?.key === undefined) ||
          isFetchingRepositories ? (
            <FormControl>
              <Select disabled={true}>
                <SelectTrigger>
                  <SelectValue placeholder={'Loading repositories'} />
                </SelectTrigger>
                <SelectContent></SelectContent>
              </Select>
            </FormControl>
          ) : (
            <FormControl>
              <Select
                onValueChange={onRepositoryChange}
                defaultValue={selectedRepository?.key}
                disabled={repos.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      update
                        ? `${defaultValues?.properties?.repository_owner}/${defaultValues?.properties?.repository_name}`
                        : isFetchingRepositories
                          ? 'Loading repositories'
                          : 'Select a GitHub repository'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {repos.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.repository_owner}/{r.repository_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
          )}
          <Button
            variant="link"
            type="button"
            className="px-0 disabled:animate-spin"
            onClick={() => refetchRepositories()}
            disabled={isFetchingRepositories}
          >
            <RefreshOutlined />
          </Button>
        </div>

        <FormMessage />
      </FormItem>

      <FormDescription>
        Not seeing your repository?{' '}
        <Button
          variant="link"
          type="button"
          onClick={openInstallationURL}
          className="h-fit p-0"
        >
          Click here
        </Button>{' '}
        to install it on Polar.
      </FormDescription>

      {/* For error messages */}
      <FormField
        control={control}
        name="properties.repository_owner"
        rules={{
          required: 'This field is required',
        }}
        render={() => {
          return (
            <FormItem>
              <FormMessage />
            </FormItem>
          )
        }}
      />

      {selectedRepository ? (
        <>
          {selectedRepository?.org?.plan_name ? (
            <div className="rounded-2xl bg-yellow-50 px-4 py-3 text-sm text-yellow-500 dark:bg-yellow-950">
              This organization is currently on the{' '}
              <span className="capitalize">
                {selectedRepository?.org?.plan_name}
              </span>
              &apos;s plan.{' '}
              <strong>
                Each subscriber will take a seat and GitHub will bill you for
                them. Make sure your pricing is covering those fees!
              </strong>
            </div>
          ) : (
            <div className="rounded-2xl bg-yellow-50 px-4 py-3 text-sm text-yellow-500 dark:bg-yellow-950">
              We can&apos;t check the GitHub billing plan for this organization.
              If you&apos;re on a paid plan{' '}
              <strong>
                each subscriber will take a seat and GitHub will bill you for
                them.
              </strong>
            </div>
          )}
        </>
      ) : null}

      <FormField
        control={control}
        name="properties.permission"
        rules={{
          required: 'This field is required',
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Role</FormLabel>
              </div>
              <FormControl>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="The role to grant the user" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(
                      SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum,
                    ).map((permission) => (
                      <SelectItem key={permission} value={permission}>
                        {
                          {
                            [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.PULL]:
                              'Read',
                            [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.TRIAGE]:
                              'Triage',
                            [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.PUSH]:
                              'Write',
                            [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.MAINTAIN]:
                              'Maintain',
                            [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.ADMIN]:
                              'Admin',
                          }[permission]
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>
                Read more about roles and their permissions on{' '}
                <a
                  href="https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization#permissions-for-each-role"
                  target="_blank"
                  rel="noopener noreferer"
                  className="text-blue-500 underline"
                >
                  GitHub documentation
                </a>
                .
              </FormDescription>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </>
  )
}
