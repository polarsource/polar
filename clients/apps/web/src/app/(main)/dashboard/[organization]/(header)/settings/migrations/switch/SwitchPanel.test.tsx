import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useMigrationSwitch: vi.fn(),
  useMigrationRecords: vi.fn(),
  useStartMigrationSwitch: vi.fn(),
  invalidateMigrationRecords: vi.fn(),
}))

vi.mock('@/hooks/queries/merchantMigrations', () => ({
  useMigrationSwitch: mocks.useMigrationSwitch,
  useMigrationRecords: mocks.useMigrationRecords,
  useStartMigrationSwitch: mocks.useStartMigrationSwitch,
  invalidateMigrationRecords: mocks.invalidateMigrationRecords,
}))

vi.mock('./SwitchPanelView', () => ({
  SwitchPanelView: () => null,
}))

import { SwitchPanel } from './SwitchPanel'

function setRunning(running: boolean) {
  mocks.useMigrationSwitch.mockReturnValue({
    data: { running, total: 5, moved: 0 },
    isLoading: false,
    isError: false,
  })
  mocks.useMigrationRecords.mockReturnValue({
    data: { items: [], pagination: { max_page: 1, total_count: 0 } },
    isLoading: false,
    isError: false,
  })
  mocks.useStartMigrationSwitch.mockReturnValue({
    isPending: false,
    isError: false,
    mutate: vi.fn(),
  })
}

describe('SwitchPanel cutover completion', () => {
  beforeEach(() => {
    mocks.invalidateMigrationRecords.mockReset()
    setRunning(false)
  })

  it('invalidates the migration, records, summary, and list when the cutover finishes', () => {
    const { rerender } = render(<SwitchPanel migrationId="mig_1" />)

    setRunning(true)
    rerender(<SwitchPanel migrationId="mig_1" />)

    setRunning(false)
    rerender(<SwitchPanel migrationId="mig_1" />)

    expect(mocks.invalidateMigrationRecords).toHaveBeenCalledTimes(1)
    expect(mocks.invalidateMigrationRecords).toHaveBeenCalledWith('mig_1')
  })

  it('does not invalidate on mount when the cutover is not running', () => {
    render(<SwitchPanel migrationId="mig_1" />)

    expect(mocks.invalidateMigrationRecords).not.toHaveBeenCalled()
  })

  it('does not invalidate while the cutover is still running', () => {
    const { rerender } = render(<SwitchPanel migrationId="mig_1" />)

    setRunning(true)
    rerender(<SwitchPanel migrationId="mig_1" />)

    expect(mocks.invalidateMigrationRecords).not.toHaveBeenCalled()
  })
})
