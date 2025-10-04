'use client'

import { createSSEListener, type EventSourceController } from '@/utils/sse'
import { useCallback, useRef, useState } from 'react'

interface SeatClaimFulfillmentOptions {
  apiBaseUrl: string
  invitationToken: string
  maxWaitingTimeMs?: number
}

const MIN_CLAIMING_DISPLAY_MS = 1_000
const BENEFIT_GRACE_PERIOD_MS = 2_000

export const useSeatClaimFulfillment = ({
  apiBaseUrl,
  invitationToken,
  maxWaitingTimeMs = 15000,
}: SeatClaimFulfillmentOptions): [
  (productId: string) => Promise<void>,
  string | null,
  () => void,
] => {
  const [fulfillmentLabel, setFulfillmentLabel] = useState<string | null>(null)
  const controllerRef = useRef<EventSourceController | null>(null)
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])

  const cleanup = useCallback(() => {
    controllerRef.current?.abort()
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const fulfillmentListener = useCallback(
    async (productId: string) => {
      cleanup() // Clear any existing listeners

      return await new Promise<void>((resolve, reject) => {
        const url = `${apiBaseUrl}/v1/customer-seats/claim/${invitationToken}/stream`
        const [seatEvents, listen] = createSSEListener(url)
        const controller = listen()
        controllerRef.current = controller

        let seatClaimed = false
        const benefitsGranted = new Set<string>()
        let seatClaimedTimestamp: number | null = null
        let benefitGrantingStarted = false
        let gracePeriodTimeout: NodeJS.Timeout | null = null

        // Listen for SSE errors
        const errorListener = (error: { type: string; error: Error }) => {
          cleanup()
          reject(new Error(`SSE ${error.type} error: ${error.error.message}`))
        }
        seatEvents.on('error', errorListener)

        const finishWithMinimumDisplay = async () => {
          controller.abort()

          // Ensure minimum display time
          const now = Date.now()
          const timeSinceClaimed = seatClaimedTimestamp
            ? now - seatClaimedTimestamp
            : 0
          const remainingTime = Math.max(
            0,
            MIN_CLAIMING_DISPLAY_MS - timeSinceClaimed,
          )

          if (remainingTime > 0) {
            await new Promise((r) => {
              const timeout = setTimeout(r, remainingTime)
              timeoutsRef.current.push(timeout)
              return timeout
            })
          }

          resolve()
        }

        const checkResolution = () => {
          // Wait for seat claim event first
          if (!seatClaimed) return

          // If we have benefits, wait for grace period to see if more arrive
          if (benefitsGranted.size > 0) {
            // Clear existing grace period timeout
            if (gracePeriodTimeout) {
              clearTimeout(gracePeriodTimeout)
            }

            // Set new grace period - if no new benefits arrive, we're done
            gracePeriodTimeout = setTimeout(() => {
              setFulfillmentLabel('Success! Redirecting...')
              finishWithMinimumDisplay()
            }, BENEFIT_GRACE_PERIOD_MS)
            timeoutsRef.current.push(gracePeriodTimeout)
          }
          // If no benefits after seat claimed, wait a bit to see if any arrive
          else if (!benefitGrantingStarted) {
            benefitGrantingStarted = true
            const timeout = setTimeout(() => {
              if (benefitsGranted.size === 0) {
                // No benefits - we're done
                setFulfillmentLabel('Success! Redirecting...')
                finishWithMinimumDisplay()
              }
            }, BENEFIT_GRACE_PERIOD_MS)
            timeoutsRef.current.push(timeout)
          }
        }

        const seatClaimedListener = (data: {
          seat_id: string
          product_id: string
        }) => {
          if (data.product_id === productId) {
            seatClaimed = true
            seatClaimedTimestamp = Date.now()
            setFulfillmentLabel('Claiming benefits...')
            seatEvents.off('customer_seat.claimed', seatClaimedListener)
            checkResolution()
          }
        }
        seatEvents.on('customer_seat.claimed', seatClaimedListener)

        const benefitGrantedListener = (data: {
          benefit_id: string
          benefit_type: string
        }) => {
          benefitsGranted.add(data.benefit_id)
          setFulfillmentLabel('Claiming benefits...')
          checkResolution()
        }
        seatEvents.on('benefit.granted', benefitGrantedListener)

        // Set a timeout to abort the listener if it takes too long
        const maxTimeout = setTimeout(() => {
          if (gracePeriodTimeout) {
            clearTimeout(gracePeriodTimeout)
          }
          controller.abort()
          // Resolve anyway - better to redirect than to block forever
          resolve()
        }, maxWaitingTimeMs)
        timeoutsRef.current.push(maxTimeout)
      })
    },
    [apiBaseUrl, invitationToken, maxWaitingTimeMs, cleanup],
  )

  return [fulfillmentListener, fulfillmentLabel, cleanup]
}
