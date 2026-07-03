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

  const goToBilling = () => {
    dismiss()
    router.push(`/dashboard/${organization.slug}/products`)
  }

  const explore = () => {
    dismiss()
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
              Your dashboard now has two surfaces. Billing that gets you paid.
              Compass which shows you what every customer, feature, and model
              actually costs to serve.
            </Text>
          </Box>
          <Box flexDirection="column" gap="s" width="100%">
            <Button onClick={explore}>Explore Compass</Button>
            <Button variant="ghost" onClick={goToBilling}>
              Go to Billing
            </Button>
          </Box>
        </Box>
      }
    />
  )
}
