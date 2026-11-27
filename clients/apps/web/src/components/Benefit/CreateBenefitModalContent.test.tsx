import { schemas } from '@polar-sh/client'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import CreateBenefitModalContent from './CreateBenefitModalContent'

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }))

vi.mock('@/hooks/queries', () => ({
  useCreateBenefit: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('./BenefitForm', () => ({ NewBenefitForm: () => null }))
vi.mock('../Toast/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

it('shows the benefit limit error without selecting a benefit or closing the form', async () => {
  const message = 'Organization has reached its limit of 1000 benefits.'
  mutateAsync.mockResolvedValue({ error: { detail: message } })
  const onSelectBenefit = vi.fn()
  const hideModal = vi.fn()
  render(
    <CreateBenefitModalContent
      organization={{ id: 'organization-id' } as schemas['Organization']}
      onSelectBenefit={onSelectBenefit}
      hideModal={hideModal}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Create' }))

  expect(await screen.findByText(message)).toBeVisible()
  expect(onSelectBenefit).not.toHaveBeenCalled()
  expect(hideModal).not.toHaveBeenCalled()
})
