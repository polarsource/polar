import { api, queryClient } from '@/utils/api'
import {
  Meter,
  MeterCreate,
  MetersApiListRequest,
  MetersApiQuantitiesRequest,
  ResponseError,
  TimeInterval,
} from '@polar-sh/api'
import { useMutation, useQuery, UseQueryResult } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useMeters = (
  organizationId: string,
  parameters?: Omit<MetersApiListRequest, 'organizationId'>,
) =>
  useQuery({
    queryKey: ['meters', { organizationId, parameters }],
    queryFn: () =>
      api.meters.list({
        organizationId,
        ...(parameters || {}),
      }),
    retry: defaultRetry,
  })

export const useMeter = (id: string, initialData?: Meter) =>
  useQuery({
    queryKey: ['meters', { id }],
    queryFn: () => api.meters.get({ id }),
    retry: defaultRetry,
    initialData,
  })

interface ParsedMeterQuantities {
  quantities: {
    timestamp: Date
    quantity: number
  }[]
}

export const useMeterQuantities = (
  id: string,
  startTimestamp: Date,
  endTimestamp: Date,
  interval: TimeInterval,
  parameters?: Omit<
    MetersApiQuantitiesRequest,
    'id' | 'startTimestamp' | 'endTimestamp' | 'interval'
  >,
): UseQueryResult<ParsedMeterQuantities, ResponseError> =>
  useQuery({
    queryKey: [
      'meters',
      'quantities',
      { id, startTimestamp, endTimestamp, interval, ...(parameters || {}) },
    ],
    queryFn: async () => {
      const result = await api.meters.quantities({
        id,
        startTimestamp: startTimestamp.toISOString(),
        endTimestamp: endTimestamp.toISOString(),
        interval,
        ...(parameters || {}),
      })
      return {
        quantities: result.quantities.map((quantity) => ({
          ...quantity,
          timestamp: new Date(quantity.timestamp),
        })),
      }
    },
    retry: defaultRetry,
  })

export const useCreateMeter = (organizationId: string) =>
  useMutation({
    mutationFn: (data: MeterCreate) =>
      api.meters.create({
        body: {
          ...data,
          organization_id: organizationId,
        },
      }),
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['meters', { organizationId }],
      })
    },
  })
