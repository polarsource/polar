'use client'

import { CompassTabs } from '@/components/Compass/CompassTabs'
import { CompassWidget } from '@/components/Compass/CompassWidget'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import { motion } from 'motion/react'

interface InsightsPageProps {
  organization: schemas['Organization']
}

export default function InsightsPage({ organization }: InsightsPageProps) {
  return (
    <DashboardBody
      title="Compass"
      header={<CompassTabs organization={organization} active="insights" />}
      wrapperClassName="max-w-3xl!"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <CompassWidget organization={organization} hideHeader layout="column" />
      </motion.div>
    </DashboardBody>
  )
}
