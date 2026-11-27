import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { trace } from '@opentelemetry/api'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { ExportResultCode } from '@opentelemetry/core'
import type { Metering } from '@polar-sh/sdk/metering'

const mockEventsIngest = vi.fn()

// Mock the Polar SDK
vi.mock('@polar-sh/sdk/2027-01', async (importOriginal) => ({
  ...(await importOriginal()),
  createPolar: () => ({ events: { ingest: mockEventsIngest } }),
}))

import { PolarTraceExporter } from './index'

describe('PolarTraceExporter', () => {
  let provider: NodeTracerProvider
  let polarExporter: PolarTraceExporter
  let memoryExporter: InMemorySpanExporter

  beforeEach(async () => {
    vi.clearAllMocks()
    mockEventsIngest.mockResolvedValue({ success: true })

    // Set up OpenTelemetry exporters
    memoryExporter = new InMemorySpanExporter()
    polarExporter = new PolarTraceExporter({ accessToken: 'test-token' })

    // Create provider with both span processors
    provider = new NodeTracerProvider({
      spanProcessors: [
        new SimpleSpanProcessor(memoryExporter),
        new SimpleSpanProcessor(polarExporter),
      ],
    })

    // Manually set the global tracer provider for this test
    trace.setGlobalTracerProvider(provider)
  })

  afterEach(async () => {
    await provider.shutdown()
    memoryExporter.reset()
    // Reset the global tracer provider
    trace.disable()
  })

  describe('export', () => {
    it('should successfully export spans with customerId', async () => {
      const tracer = trace.getTracer('test-tracer')

      const span = tracer.startSpan('test-event', {
        attributes: {
          customerId: 'customer-123',
          key1: 'value1',
          key2: 42,
        },
      })
      span.end()

      await provider.forceFlush()

      expect(mockEventsIngest).toHaveBeenCalledTimes(1)
      const callArgs = mockEventsIngest.mock.calls[0]?.[0]
      if (!callArgs) throw new Error('callArgs undefined')
      expect(callArgs.events).toHaveLength(1)
      expect(callArgs.events[0]).toMatchObject({
        name: 'test-event',
        customer_id: 'customer-123',
        metadata: expect.objectContaining({
          customerId: 'customer-123',
          key1: 'value1',
          key2: 42,
        }),
      })
    })

    it('should successfully export spans with externalCustomerId', async () => {
      const tracer = trace.getTracer('test-tracer')

      const span = tracer.startSpan('test-event', {
        attributes: {
          externalCustomerId: 'external-123',
          key1: 'value1',
        },
      })
      span.end()

      await provider.forceFlush()

      expect(mockEventsIngest).toHaveBeenCalledTimes(1)
      const callArgs = mockEventsIngest.mock.calls[0]?.[0]
      if (!callArgs) throw new Error('callArgs undefined')
      expect(callArgs.events).toHaveLength(1)
      expect(callArgs.events[0]).toMatchObject({
        name: 'test-event',
        external_customer_id: 'external-123',
        metadata: expect.objectContaining({
          externalCustomerId: 'external-123',
          key1: 'value1',
        }),
      })
    })

    it('should filter out spans without customerId or externalCustomerId', async () => {
      const tracer = trace.getTracer('test-tracer')

      const span1 = tracer.startSpan('event-with-customer', {
        attributes: {
          customerId: 'customer-123',
          key1: 'value1',
        },
      })
      span1.end()

      const span2 = tracer.startSpan('event-without-customer', {
        attributes: {
          key2: 'value2',
        },
      })
      span2.end()

      const span3 = tracer.startSpan('event-with-external-customer', {
        attributes: {
          externalCustomerId: 'external-456',
          key3: 'value3',
        },
      })
      span3.end()

      await provider.forceFlush()

      // With SimpleSpanProcessor, each span is exported immediately
      // The exporter is called 3 times, but filters out invalid spans
      expect(mockEventsIngest).toHaveBeenCalledTimes(3)

      // Check first call
      const call1 = mockEventsIngest.mock.calls[0]?.[0]
      if (!call1) throw new Error('call1 undefined')
      expect(call1.events).toHaveLength(1)
      expect(call1.events[0]).toMatchObject({
        name: 'event-with-customer',
        customer_id: 'customer-123',
        metadata: expect.objectContaining({
          customerId: 'customer-123',
          key1: 'value1',
        }),
      })

      // Check second call (empty because span has no customer ID)
      const call2 = mockEventsIngest.mock.calls[1]?.[0]
      if (!call2) throw new Error('call2 undefined')
      expect(call2.events).toHaveLength(0)

      // Check third call
      const call3 = mockEventsIngest.mock.calls[2]?.[0]
      if (!call3) throw new Error('call3 undefined')
      expect(call3.events).toHaveLength(1)
      expect(call3.events[0]).toMatchObject({
        name: 'event-with-external-customer',
        external_customer_id: 'external-456',
        metadata: expect.objectContaining({
          externalCustomerId: 'external-456',
          key3: 'value3',
        }),
      })
    })

    it('should handle different attribute types correctly', async () => {
      const tracer = trace.getTracer('test-tracer')

      const span = tracer.startSpan('test-event', {
        attributes: {
          customerId: 'customer-123',
          stringValue: 'hello',
          numberValue: 42,
          booleanValue: true,
        },
      })
      span.end()

      await provider.forceFlush()

      expect(mockEventsIngest).toHaveBeenCalledTimes(1)
      const callArgs = mockEventsIngest.mock.calls[0]?.[0]
      if (!callArgs) throw new Error('callArgs undefined')
      expect(callArgs.events).toHaveLength(1)
      expect(callArgs.events[0]).toMatchObject({
        name: 'test-event',
        customer_id: 'customer-123',
        metadata: expect.objectContaining({
          customerId: 'customer-123',
          stringValue: 'hello',
          numberValue: 42,
          booleanValue: true,
        }),
      })
    })

    it('should handle export errors and return FAILED status', async () => {
      // Create a separate exporter for this test to avoid conflicts
      const error = new Error('Network error')

      // Create a new provider without the polar exporter to avoid double export
      const testProvider = new NodeTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(memoryExporter)],
      })

      const testTracer = testProvider.getTracer('test-tracer')
      const span = testTracer.startSpan('test-event', {
        attributes: {
          customerId: 'customer-123',
        },
      })
      span.end()

      await testProvider.forceFlush()
      const exportedSpans = memoryExporter.getFinishedSpans()

      // Override the mock for this test
      mockEventsIngest.mockRejectedValueOnce(error)

      // Test the exporter directly with the real spans
      await new Promise<void>((resolve) => {
        polarExporter.export(exportedSpans, (result) => {
          expect(result.code).toBe(ExportResultCode.FAILED)
          expect(result.error).toBe(error)
          resolve()
        })
      })

      await testProvider.shutdown()
    })

    it('should handle empty spans array', async () => {
      await new Promise<void>((resolve) => {
        polarExporter.export([], (result) => {
          expect(result.code).toBe(ExportResultCode.SUCCESS)
          resolve()
        })
      })

      expect(mockEventsIngest).toHaveBeenCalledWith({
        events: [],
      })
    })

    it('should prefer customerId over externalCustomerId if both are present', async () => {
      const tracer = trace.getTracer('test-tracer')

      const span = tracer.startSpan('test-event', {
        attributes: {
          customerId: 'customer-123',
          externalCustomerId: 'external-456',
          key1: 'value1',
        },
      })
      span.end()

      await provider.forceFlush()

      expect(mockEventsIngest).toHaveBeenCalledTimes(1)
      const callArgs = mockEventsIngest.mock.calls[0]?.[0]
      if (!callArgs) throw new Error('callArgs undefined')
      expect(callArgs.events).toHaveLength(1)
      expect(callArgs.events[0]).toMatchObject({
        name: 'test-event',
        customer_id: 'customer-123',
        metadata: expect.objectContaining({
          customerId: 'customer-123',
          externalCustomerId: 'external-456',
          key1: 'value1',
        }),
      })
      // Ensure external_customer_id is NOT set at the top level
      expect(callArgs.events[0]).not.toHaveProperty('external_customer_id')
    })

    it('should filter out spans with non-string customerId', async () => {
      const tracer = trace.getTracer('test-tracer')

      const span1 = tracer.startSpan('event-with-valid-customer', {
        attributes: {
          customerId: 'customer-123',
        },
      })
      span1.end()

      const span2 = tracer.startSpan('event-with-numeric-customer', {
        attributes: {
          customerId: 12345,
        },
      })
      span2.end()

      const span3 = tracer.startSpan('event-with-boolean-customer', {
        attributes: {
          customerId: true,
        },
      })
      span3.end()

      await provider.forceFlush()

      // The exporter is called 3 times, but only valid string customer IDs are exported
      expect(mockEventsIngest).toHaveBeenCalledTimes(3)

      // First call has valid customer ID
      const call1 = mockEventsIngest.mock.calls[0]?.[0]
      if (!call1) throw new Error('call1 undefined')
      expect(call1.events).toHaveLength(1)
      expect(call1.events[0]).toMatchObject({
        name: 'event-with-valid-customer',
        customer_id: 'customer-123',
        metadata: expect.objectContaining({
          customerId: 'customer-123',
        }),
      })

      // Second and third calls have empty events arrays (filtered out)
      const call2 = mockEventsIngest.mock.calls[1]?.[0]
      if (!call2) throw new Error('call2 undefined')
      expect(call2.events).toHaveLength(0)

      const call3 = mockEventsIngest.mock.calls[2]?.[0]
      if (!call3) throw new Error('call3 undefined')
      expect(call3.events).toHaveLength(0)
    })

    it('should export multiple valid spans in a single batch', async () => {
      const tracer = trace.getTracer('test-tracer')

      const span1 = tracer.startSpan('event-1', {
        attributes: {
          customerId: 'customer-1',
          metric1: 100,
        },
      })
      span1.end()

      const span2 = tracer.startSpan('event-2', {
        attributes: {
          externalCustomerId: 'external-1',
          metric2: 200,
        },
      })
      span2.end()

      const span3 = tracer.startSpan('event-3', {
        attributes: {
          customerId: 'customer-2',
          metric3: 300,
        },
      })
      span3.end()

      await provider.forceFlush()

      // SimpleSpanProcessor exports each span immediately,
      // so we expect 3 calls
      expect(mockEventsIngest).toHaveBeenCalledTimes(3)

      // Verify all spans were exported correctly
      const call1 = mockEventsIngest.mock.calls[0]?.[0]
      if (!call1) throw new Error('call1 undefined')
      expect(call1.events[0]).toMatchObject({
        name: 'event-1',
        customer_id: 'customer-1',
        metadata: expect.objectContaining({
          customerId: 'customer-1',
          metric1: 100,
        }),
      })

      const call2 = mockEventsIngest.mock.calls[1]?.[0]
      if (!call2) throw new Error('call2 undefined')
      expect(call2.events[0]).toMatchObject({
        name: 'event-2',
        external_customer_id: 'external-1',
        metadata: expect.objectContaining({
          externalCustomerId: 'external-1',
          metric2: 200,
        }),
      })

      const call3 = mockEventsIngest.mock.calls[2]?.[0]
      if (!call3) throw new Error('call3 undefined')
      expect(call3.events[0]).toMatchObject({
        name: 'event-3',
        customer_id: 'customer-2',
        metadata: expect.objectContaining({
          customerId: 'customer-2',
          metric3: 300,
        }),
      })
    })
  })

  describe('shutdown', () => {
    it('should resolve immediately', async () => {
      const result = await polarExporter.shutdown()
      expect(result).toBeUndefined()
    })
  })

  describe('with polar.metering()', () => {
    it('should track spans with a customer and flush on shutdown', async () => {
      const metering = { track: vi.fn(), flush: vi.fn() }
      const exporter = new PolarTraceExporter(metering as unknown as Metering)
      const meteringProvider = new NodeTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(exporter)],
      })
      const tracer = meteringProvider.getTracer('test-tracer')

      const parent = tracer.startSpan('report_generated', {
        attributes: { externalCustomerId: 'external-123', pages: 12 },
      })
      parent.end()
      tracer.startSpan('no-customer').end()

      await meteringProvider.shutdown()

      expect(metering.track).toHaveBeenCalledExactlyOnceWith({
        name: 'report_generated',
        external_customer_id: 'external-123',
        metadata: { externalCustomerId: 'external-123', pages: 12 },
        parent_id: undefined,
        external_id: parent.spanContext().spanId,
      })
      expect(metering.flush).toHaveBeenCalledOnce()
      expect(mockEventsIngest).not.toHaveBeenCalled()
    })
  })
})
