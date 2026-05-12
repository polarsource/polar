'use client'

import { ReviewChecklist } from '@/components/Finance/Account/ReviewChecklist'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { toast } from '@/components/Toast/use-toast'
import { usePostHog } from '@/hooks/posthog'
import { useProducts } from '@/hooks/queries'
import {
  useOrganizationKYC,
  useOrganizationReviewState,
  useSubmitOrganizationReview,
} from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const ROW_STAGGER = 0.06
const ROW_DURATION = 0.32
const HEADER_DURATION = 0.28
const HEADER_GAP = 0.04

interface Props {
  organization: schemas['Organization']
}

export const AccountPageDetailsRequiredV2 = ({ organization }: Props) => {
  const router = useRouter()
  const { data: reviewState, isLoading } = useOrganizationReviewState(
    organization.id,
  )

  // Warm the KYC query cache so expanding the Product Description section
  // doesn't show its loading state mid-accordion-animation.
  useOrganizationKYC(organization.id)

  // Warm the products query cache so the Product Configuration section
  // doesn't briefly flash the empty state while it fetches.
  useProducts(organization.id, { limit: 1 })

  const submitReview = useSubmitOrganizationReview(organization.id)
  const posthog = usePostHog()

  const [isExiting, setIsExiting] = useState(false)

  const steps = reviewState?.preliminary_steps ?? []
  const rowsExitSeconds =
    Math.max(0, steps.length - 1) * ROW_STAGGER + ROW_DURATION
  const headerDelay = rowsExitSeconds + HEADER_GAP
  const totalExitMs = (headerDelay + HEADER_DURATION) * 1000

  const handleSubmit = async () => {
    if (isExiting) return

    posthog.capture('dashboard:organizations:account_review:submit', {
      organization_id: organization.id,
      section: 'cta',
    })

    setIsExiting(true)

    const [{ error }] = await Promise.all([
      submitReview.mutateAsync(),
      new Promise((resolve) => setTimeout(resolve, totalExitMs)),
    ])

    if (error) {
      toast({
        title: 'Submission failed',
        description:
          'We could not submit your organization for review. Please try again.',
      })
      setIsExiting(false)
      return
    }

    router.refresh()
  }

  const titleNode = (
    <motion.h4
      className="text-2xl font-medium whitespace-nowrap dark:text-white"
      initial={false}
      animate={isExiting ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
      transition={{
        duration: HEADER_DURATION,
        delay: isExiting ? headerDelay : 0,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      Account Review
    </motion.h4>
  )

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-sm)!"
      title={titleNode}
      header={
        <motion.div
          initial={false}
          animate={isExiting ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
          transition={{
            duration: HEADER_DURATION,
            delay: isExiting ? headerDelay : 0,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          <Button
            onClick={handleSubmit}
            disabled={!reviewState?.can_submit || isExiting}
            loading={isExiting}
          >
            Submit for review
          </Button>
        </motion.div>
      }
    >
      <Box
        display="flex"
        flexDirection="column"
        rowGap="xl"
        paddingBottom="3xl"
      >
        <motion.div
          initial={false}
          animate={isExiting ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
          transition={{
            duration: HEADER_DURATION,
            delay: isExiting ? headerDelay : 0,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          <Text variant="body" color="muted">
            Verify your business so customers can buy from you. After you
            submit, our team will review your details and get back to you
            shortly.
          </Text>
        </motion.div>
        <ReviewChecklist
          isLoading={isLoading}
          isExiting={isExiting}
          steps={steps}
          rowStagger={ROW_STAGGER}
          rowDuration={ROW_DURATION}
        />
      </Box>
    </DashboardBody>
  )
}
