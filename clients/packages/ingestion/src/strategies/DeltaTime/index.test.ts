import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DeltaTimeStrategy } from '.'
import { IngestionStrategy } from '../../strategy'

describe('DeltaTimeStrategy', () => {
  // Mock implementation for nowResolver
  let mockTimeValue = 1000
  const mockNowResolver = vi.fn(() => mockTimeValue)

  // Mock for createExecutionHandler
  const mockExecute = vi.fn()

  // Test subject
  let deltaTimeStrategy: DeltaTimeStrategy

  beforeEach(() => {
    // Reset mocks and create fresh instance for each test
    vi.clearAllMocks()
    mockTimeValue = 1000

    deltaTimeStrategy = new DeltaTimeStrategy(mockNowResolver)
    // Mock the createExecutionHandler method
    vi.spyOn(deltaTimeStrategy, 'createExecutionHandler').mockReturnValue(
      mockExecute,
    )
  })

  it('should be an instance of IngestionStrategy', () => {
    expect(deltaTimeStrategy).toBeInstanceOf(IngestionStrategy)
  })

  it('should initialize with the provided nowResolver', () => {
    expect(deltaTimeStrategy.nowResolver).toBe(mockNowResolver)
  })

  it('client method should return a start function', () => {
    const customerId = 'test-customer-id'
    const startFn = deltaTimeStrategy.client({
      customerId,
    })

    expect(typeof startFn).toBe('function')
  })

  it('start function should return a stop function', () => {
    const customerId = 'test-customer-id'
    const startFn = deltaTimeStrategy.client({
      customerId,
    })
    const stopFn = startFn()

    expect(typeof stopFn).toBe('function')
  })

  it('should calculate correct delta time between start and stop', () => {
    const customerId = 'test-customer-id'
    const startFn = deltaTimeStrategy.client({
      customerId,
    })

    // First call to nowResolver (start time)
    const stopFn = startFn()
    expect(mockNowResolver).toHaveBeenCalledTimes(1)

    // Simulate time passing
    mockTimeValue = 1500

    // Call stop function
    const deltaTime = stopFn()

    // Second call to nowResolver (end time)
    expect(mockNowResolver).toHaveBeenCalledTimes(2)

    // Check delta time calculation
    expect(deltaTime).toBe(500) // 1500 - 1000 = 500
  })

  it('should call execution handler with correct context and customerId', () => {
    const customerId = 'test-customer-id'
    const startFn = deltaTimeStrategy.client({
      customerId,
    })

    // Start time = 1000
    const stopFn = startFn()

    // Simulate time passing
    mockTimeValue = 1300

    // Call stop function
    stopFn()

    // Verify execution handler was called with correct parameters
    expect(mockExecute).toHaveBeenCalledTimes(1)
    expect(mockExecute).toHaveBeenCalledWith(
      { deltaTime: 300, strategy: 'DeltaTime' },
      { customerId },
    )
  })

  it('should return the calculated delta time from stop function', () => {
    const customerId = 'test-customer-id'
    const startFn = deltaTimeStrategy.client({
      customerId,
    })

    // Start time = 1000
    const stopFn = startFn()

    // Simulate time passing
    mockTimeValue = 1800

    // Call stop function and check return value
    const returnedDeltaTime = stopFn()
    expect(returnedDeltaTime).toBe(800) // 1800 - 1000 = 800
  })
})
