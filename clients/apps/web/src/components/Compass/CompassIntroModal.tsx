'use client'

import { Compass } from '@/components/Landing/graphics/Compass'
import { useDismissed } from '@/hooks/useDismissed'
import { schemas } from '@polar-sh/client'
import { Button, Modal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const COMPASS_INTRO_KEY = 'compass_intro'

export const CompassIntroModal = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const { isDismissed, dismiss: markDismissed } =
    useDismissed(COMPASS_INTRO_KEY)

  const [closed, setClosed] = useState(false)

  const compassEnabled = !!organization.feature_settings?.compass_enabled

  // Derived from live state so it self-corrects once `isDismissed` resolves
  // from localStorage (default is `false` during SSR/hydration). Latching this
  // in an effect would keep the modal open for already-dismissed users.
  const isShown = compassEnabled && !isDismissed && !closed

  const dismiss = () => {
    setClosed(true)
    markDismissed()
  }

  const explore = () => {
    dismiss()
    router.push(`/dashboard/${organization.slug}/compass`)
  }

  return (
    <Modal
      title="Introducing Compass"
      isShown={isShown}
      hide={dismiss}
      className="max-w-xl!"
      modalContent={
        <Box
          flexDirection="column"
          alignItems="center"
          gap="2xl"
          paddingVertical="2xl"
          paddingHorizontal="4xl"
          textAlign="center"
        >
          <Box flexDirection="column" alignItems="center" gap="m">
            <Box display="block" width={250} height={250}>
              <Compass />
            </Box>
            <Text variant="heading-s" as="h2">
              Introducing Compass
            </Text>
            <Text color="muted" variant="body" wrap="pretty">
              Ask anything about your revenue, costs, churn or customers and get
              answers grounded in your data. Insights watch your metrics and
              surface what needs attention.
            </Text>
          </Box>
          <Box flexDirection="column" gap="s" width="100%">
            <Button onClick={explore}>Explore Compass</Button>
            <Button variant="ghost" onClick={dismiss}>
              Close
            </Button>
          </Box>
        </Box>
      }
    />
  )
}
