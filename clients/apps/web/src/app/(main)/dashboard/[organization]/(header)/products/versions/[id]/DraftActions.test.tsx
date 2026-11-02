import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DraftActions } from './DraftActions'

const publish = vi.fn(() => Promise.resolve())
const discard = vi.fn(() => Promise.resolve())
const push = vi.fn()

vi.mock('@/hooks/queries/catalogs', () => ({
  usePublishCatalog: () => ({ mutateAsync: publish }),
  useDiscardCatalog: () => ({ mutateAsync: discard }),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

vi.mock('@/components/Modal/ConfirmModal', () => ({
  ConfirmModal: ({
    isShown,
    destructiveText,
    onConfirm,
  }: {
    isShown: boolean
    destructiveText: string
    onConfirm: () => unknown
  }) =>
    isShown ? (
      <button onClick={onConfirm}>Confirm {destructiveText}</button>
    ) : null,
}))

vi.mock('@polar-sh/orbit', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode
    onClick: () => void
  }) => <button onClick={onClick}>{children}</button>,
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe('DraftActions', () => {
  it('publishes the draft after confirmation', () => {
    render(<DraftActions catalogId="draft-1" versionsPath="/versions" />)

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Publish' }))

    expect(publish).toHaveBeenCalledWith('draft-1')
  })

  it('goes back to the versions list after discarding', async () => {
    render(<DraftActions catalogId="draft-1" versionsPath="/versions" />)

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Discard' }))

    expect(discard).toHaveBeenCalledWith('draft-1')
    await waitFor(() => expect(push).toHaveBeenCalledWith('/versions'))
  })
})
