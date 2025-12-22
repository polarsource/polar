import { useAuth } from '@/hooks'
import { useListIntegrationsGithubRepositoryBenefitUserRepositories } from '@/hooks/queries'
import { useUserSSE } from '@/hooks/sse'
import { getGitHubRepositoryBenefitAuthorizeURL } from '@/utils/auth'
import { defaultApiUrl } from '@/utils/domain'
import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import { enums, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'

interface GitHubRepositoryBenefitFormProps {
  update?: boolean
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
  } = useFormContext<schemas['BenefitGitHubRepositoryCreate']>()

  const pathname = usePathname()

  const description = watch('description')

  const { currentUser } = useAuth()

  const {
    data: repositories,
    refetch: refetchRepositories,
    isFetching: isFetchingRepositories,
    error: repositoriesError,
  } = useListIntegrationsGithubRepositoryBenefitUserRepositories()

  useEffect(() => {
    if (repositoriesError) {
      setError('properties.repository_owner', {
        message: repositoriesError.error['detail'],
        type: repositoriesError.error['type'],
      })
    } else {
      clearErrors('properties.repository_owner')
    }
  }, [repositoriesError, setError, clearErrors])

  const userGitHubBenefitOauth = currentUser?.oauth_accounts.find(
    (o) => o.platform === 'github_repository_benefit',
  )

  const emitter = useUserSSE()

  const openInstallationURL = useCallback(() => {
    const installationWindow = window.open(
      `${defaultApiUrl}/v1/integrations/github_repository_benefit/installation/install`,
      '_blank',
    )

    const closeWindowListener = () => {
      if (installationWindow) {
        installationWindow.close()
      }
      refetchRepositories()
    }

    emitter.once(
      'integrations.github_repository_benefit.installed',
      closeWindowListener,
    )
  }, [emitter, refetchRepositories])

  type GitHubInvitesBenefitRepositoryWithKey =
    schemas['GitHubInvitesBenefitRepository'] & {
      org: schemas['GitHubInvitesBenefitOrganization'] | undefined
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

  const onRepositoryChange = useCallback(
    (key: string, onChange: (value: string) => void) => {
      const repo = repos.find((r) => r.key == key)
      if (!repo) {
        return
      }
      setSelectedRepository(repo)
      setValue('properties.repository_owner', repo.repository_owner)
      onChange(repo.repository_name)
    },
    [repos, setValue],
  )

  const formRepoOwner = watch('properties.repository_owner')

  useEffect(() => {
    const org = repositories?.organizations.find(
      (o) => o.name === formRepoOwner,
    )

    if (org?.is_personal) {
      setError('properties.repository_owner', {
        message:
          'For security reasons, we do not support configuring a repository on a personal organization.',
      })
    } else {
      clearErrors('properties.repository_owner')
    }
  }, [formRepoOwner, repositories, clearErrors, setError])

  // Set selected on load
  const didSetOnLoad = useRef(false)
  useEffect(() => {
    if (didSetOnLoad.current || isFetchingRepositories) {
      return
    }

    const defaultProperties = defaultValues?.properties

    if (
      defaultProperties &&
      defaultProperties.repository_owner &&
      defaultProperties.repository_name
    ) {
      const key = `${defaultProperties.repository_owner}/${defaultProperties.repository_name}`
      const repo = repos.find((r) => r.key == key)
      if (repo) {
        didSetOnLoad.current = true
        onRepositoryChange(key, (v: string) =>
          setValue('properties.repository_name', v),
        )
      }
    }
  }, [
    repositories?.repositories,
    isFetchingRepositories,
    defaultValues,
    onRepositoryChange,
    repos,
    setValue,
  ])

  const authorizeURL = useMemo(() => {
    const searchParams = new URLSearchParams()
    if (!update) {
      searchParams.set('create_benefit', 'true')
      searchParams.set('type', 'github_repository')
      searchParams.set('description', description)
    }
    const returnTo = `${pathname}?${searchParams}`
    return getGitHubRepositoryBenefitAuthorizeURL({ return_to: returnTo })
  }, [pathname, description, update])

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

      <FormField
        control={control}
        name="properties.repository_name"
        rules={{
          required: 'This field is required',
        }}
        render={({ field }) => {
          return (
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
                        <SelectValue placeholder="Loading repositories" />
                      </SelectTrigger>
                      <SelectContent></SelectContent>
                    </Select>
                  </FormControl>
                ) : (
                  <FormControl>
                    <Select
                      onValueChange={(key) =>
                        onRepositoryChange(key, field.onChange)
                      }
                      defaultValue={selectedRepository?.key}
                      disabled={repos.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            update && defaultValues && defaultValues.properties
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
          )
        }}
      />

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
          {selectedRepository?.org?.plan_name &&
          !selectedRepository?.org?.is_free ? (
            <div className="rounded-2xl bg-yellow-50 px-4 py-3 text-sm text-yellow-500 dark:bg-yellow-950">
              This organization is currently on the GitHub{' '}
              <span className="capitalize">
                {selectedRepository?.org?.plan_name}
              </span>{' '}
              plan.{' '}
              <strong className="font-medium">
                Each subscriber will take a seat and GitHub will bill you for
                them. Make sure your pricing is covering those fees!
              </strong>
            </div>
          ) : (
            <div className="rounded-2xl bg-yellow-50 px-4 py-3 text-sm text-yellow-500 dark:bg-yellow-950">
              We can&apos;t check the GitHub billing plan for this organization.
              If you&apos;re on a paid plan,{' '}
              <strong className="font-medium">
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
                      enums.benefitGitHubRepositoryPropertiesPermissionValues,
                    ).map((permission) => (
                      <SelectItem key={permission} value={permission}>
                        {
                          {
                            pull: 'Read',
                            triage: 'Triage',
                            push: 'Write',
                            maintain: 'Maintain',
                            admin: 'Admin',
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
                  rel="noopener noreferer noreferrer"
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
