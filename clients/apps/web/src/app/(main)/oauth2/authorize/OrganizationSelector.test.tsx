import { fireEvent, render, screen } from '@testing-library/react'
import { type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@polar-sh/orbit', () => ({
  Avatar: () => <span aria-hidden="true" />,
  Switch: ({
    checked,
    name,
    value,
    onCheckedChange,
  }: {
    checked: boolean
    name?: string
    value?: string
    onCheckedChange: (checked: boolean) => void
  }) => (
    <input
      type="checkbox"
      name={name}
      value={value}
      checked={checked}
      onChange={(event) => onCheckedChange(event.currentTarget.checked)}
    />
  ),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

const { default: OrganizationSelector } = await import('./OrganizationSelector')

const organizations = [
  {
    id: '4e94e15f-0c4a-4667-bd14-12680a0ac366',
    slug: 'acme',
    avatar_url: null,
  },
  {
    id: '83b81a4e-6e50-4af1-9b6b-5b70f38b3f70',
    slug: 'polar',
    avatar_url: null,
  },
]

describe('OrganizationSelector', () => {
  it('renders every organization while all organizations is selected', () => {
    render(<OrganizationSelector organizations={organizations} />)

    expect(
      (
        screen.getByLabelText(
          'All current and future organizations',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true)
    expect((screen.getByLabelText('acme') as HTMLInputElement).checked).toBe(
      false,
    )
    expect((screen.getByLabelText('polar') as HTMLInputElement).checked).toBe(
      false,
    )
    expect(screen.getByText('or select specific organizations')).toBeTruthy()
  })

  it('switches between all and specific organizations', () => {
    render(
      <form data-testid="form">
        <OrganizationSelector organizations={organizations} />
      </form>,
    )

    fireEvent.click(screen.getByLabelText('acme'))

    expect(
      (
        screen.getByLabelText(
          'All current and future organizations',
        ) as HTMLInputElement
      ).checked,
    ).toBe(false)
    expect((screen.getByLabelText('acme') as HTMLInputElement).checked).toBe(
      true,
    )

    fireEvent.click(screen.getByLabelText('polar'))
    expect((screen.getByLabelText('acme') as HTMLInputElement).checked).toBe(
      true,
    )
    expect((screen.getByLabelText('polar') as HTMLInputElement).checked).toBe(
      true,
    )

    fireEvent.click(
      screen.getByLabelText('All current and future organizations'),
    )

    expect(
      (
        screen.getByLabelText(
          'All current and future organizations',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true)
    expect((screen.getByLabelText('acme') as HTMLInputElement).checked).toBe(
      false,
    )
    expect((screen.getByLabelText('polar') as HTMLInputElement).checked).toBe(
      false,
    )
    expect(
      new FormData(screen.getByTestId('form') as HTMLFormElement).getAll(
        'organizations',
      ),
    ).toEqual([])
  })

  it('keeps single-organization authorization specific-only', () => {
    render(<OrganizationSelector organizations={organizations} singleSelect />)

    expect(
      screen.queryByText('All current and future organizations'),
    ).toBeNull()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })
})
