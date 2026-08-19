import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@polar-sh/orbit', () => ({
  Button: ({
    children,
    onClick,
  }: PropsWithChildren & { onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Input: (props: Record<string, unknown>) => <input {...(props as object)} />,
}))

const writeText = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true,
  })
})

describe('CopyToClipboardInput', () => {
  afterEach(() => {
    cleanup()
  })

  it('copies the value to the clipboard when the Copy button is clicked', () => {
    const { getByRole } = render(
      <CopyToClipboardInput value="my-secret-value" variant="mono" />,
    )

    fireEvent.click(getByRole('button'))
    expect(writeText).toHaveBeenCalledWith('my-secret-value')
  })

  it('copies an empty string instead of "undefined" when value is undefined', () => {
    const { getByRole } = render(
      <CopyToClipboardInput
        value={undefined as unknown as string}
        variant="mono"
      />,
    )

    fireEvent.click(getByRole('button'))
    expect(writeText).toHaveBeenCalledWith('')
    expect(writeText).not.toHaveBeenCalledWith('undefined')
  })
})
