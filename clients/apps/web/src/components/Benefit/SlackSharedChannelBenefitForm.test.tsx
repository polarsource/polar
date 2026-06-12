import { render } from '@testing-library/react'
import { ReactNode, useEffect } from 'react'
import { FormProvider, UseFormReturn, useForm } from 'react-hook-form'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/org/products/benefits',
  useSearchParams: () =>
    new URLSearchParams('slack_integration_id=integration-id'),
}))

vi.mock('@/hooks/queries', () => ({
  useDeleteSlackIntegration: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useSlackIntegration: vi.fn(),
  useSlackIntegrations: vi.fn(),
}))

vi.mock('./ChannelNamePreview', () => ({
  ChannelNamePreview: () => <div data-testid="channel-name-preview" />,
}))

vi.mock('./SlackIntegrationSetupPanel', () => ({
  SlackIntegrationSetupPanel: () => <div data-testid="setup-panel" />,
}))

vi.mock('./SlackTeamInviteesSelect', () => ({
  SlackTeamInviteesSelect: () => <div data-testid="team-invitees" />,
}))

vi.mock('../Modal/ConfirmModal', () => ({
  ConfirmModal: () => null,
}))

vi.mock('../Toast/use-toast', () => ({
  toast: vi.fn(),
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@polar-sh/orbit', () => ({
  Button: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  Checkbox: ({
    checked,
    defaultChecked,
    onCheckedChange,
  }: {
    checked?: boolean
    defaultChecked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      type="checkbox"
      checked={checked}
      defaultChecked={defaultChecked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SelectValue: () => null,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TextArea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}))

const { useSlackIntegration, useSlackIntegrations } =
  await import('@/hooks/queries')
const { SlackSharedChannelBenefitForm } =
  await import('./SlackSharedChannelBenefitForm')

type FormValues = {
  type: 'slack_shared_channel'
  description: string
  properties: {
    slack_integration_id?: string
    private?: boolean
    archive_on_revoke?: boolean
  }
}

const organization = {
  id: 'organization-id',
  name: 'Acme',
} as Parameters<typeof SlackSharedChannelBenefitForm>[0]['organization']

const connectedIntegration = {
  id: 'integration-id',
  display_name: 'Acme',
  slack_app_id: 'A123',
  client_id: '100.200',
  client_secret_last_4: 'cret',
  signing_secret_last_4: 'cret',
  team_id: 'T123',
  team_name: 'Acme Team',
  bot_user_id: 'U123',
  authed_user_id: 'U456',
  scopes: ['channels:manage'],
  installed_at: '2026-01-01T00:00:00Z',
  revoked_at: null,
  created_at: '2026-01-01T00:00:00Z',
  modified_at: null,
} as ReturnType<typeof useSlackIntegration>['data']

const defaultValues: FormValues = {
  type: 'slack_shared_channel',
  description: 'Slack',
  properties: {
    slack_integration_id: 'integration-id',
  },
}

const renderForm = () => {
  let form: UseFormReturn<FormValues> | undefined

  const Harness = () => {
    const methods = useForm<FormValues>({ defaultValues })
    useEffect(() => {
      form = methods
    }, [methods])
    return (
      <FormProvider {...methods}>
        <SlackSharedChannelBenefitForm organization={organization} />
      </FormProvider>
    )
  }

  const result = render(<Harness />)
  if (!form) {
    throw new Error('Form did not initialize')
  }
  return { ...result, form }
}

describe('SlackSharedChannelBenefitForm', () => {
  beforeEach(() => {
    vi.mocked(useSlackIntegration).mockReset()
    vi.mocked(useSlackIntegrations).mockReset()
  })

  it('keeps the OAuth integration id while the selected integration is loading', () => {
    vi.mocked(useSlackIntegrations).mockReturnValue({
      data: undefined,
    } as never)
    vi.mocked(useSlackIntegration).mockReturnValue({ data: undefined } as never)

    const { form } = renderForm()

    expect(form.getValues('properties.slack_integration_id')).toBe(
      'integration-id',
    )
  })

  it('checks Slack channel defaults when the connected integration is loaded', () => {
    vi.mocked(useSlackIntegrations).mockReturnValue({
      data: undefined,
    } as never)
    vi.mocked(useSlackIntegration).mockReturnValue({
      data: connectedIntegration,
    } as never)

    const { container } = renderForm()
    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    )

    expect(checkboxes).toHaveLength(2)
    expect(checkboxes.every((checkbox) => checkbox.checked)).toBe(true)
  })
})
