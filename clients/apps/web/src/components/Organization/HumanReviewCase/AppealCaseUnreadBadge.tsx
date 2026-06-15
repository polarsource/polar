'use client'

import { schemas } from '@polar-sh/client'
import { motion } from 'motion/react'
import React from 'react'
import { useAppealCaseUnreadCount } from './appealCaseUnread'

export const AppealCaseUnreadBadge = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const unread = useAppealCaseUnreadCount(organization)

  if (unread === 0) return null

  return (
    <motion.span
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      aria-label="Unread support messages"
      className="bg-blue h-1.5 w-1.5 rounded-full"
    />
  )
}
