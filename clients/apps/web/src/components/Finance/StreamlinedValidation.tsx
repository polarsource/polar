'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  HelpCircle,
  Loader2,
  MessageSquare,
  Shield,
} from 'lucide-react'
import React, { useState } from 'react'

import { ValidationResult, ValidationStatus } from '@/hooks/queries/validation'

interface StreamlinedValidationProps {
  organizationId: string
  validationResult?: ValidationResult
  onValidate: () => Promise<void>
  onRequestHumanReview: () => Promise<void>
  loading?: boolean
}

const StatusIcon = ({ status }: { status: ValidationStatus }) => {
  switch (status) {
    case 'validating':
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
    case 'approved':
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case 'uncertain':
      return <HelpCircle className="h-5 w-5 text-yellow-500" />
    case 'denied':
      return <AlertTriangle className="h-5 w-5 text-red-500" />
    default:
      return <Shield className="h-5 w-5 text-gray-400" />
  }
}

const StatusBadge = ({ status }: { status: ValidationStatus }) => {
  const config = {
    validating: { label: 'Reviewing', className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' },
    approved: { label: 'Approved', className: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' },
    uncertain: { label: 'Pending Review', className: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' },
    denied: { label: 'Attention Needed', className: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
    idle: { label: 'Not Started', className: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  }

  const { label, className } = config[status]
  
  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${className}`}>
      <StatusIcon status={status} />
      <span className="ml-1.5">{label}</span>
    </div>
  )
}

export default function StreamlinedValidation({
  validationResult,
  onValidate,
  onRequestHumanReview,
  loading = false,
}: StreamlinedValidationProps) {
  const [isValidating, setIsValidating] = useState(false)
  const [isRequestingReview, setIsRequestingReview] = useState(false)

  const handleValidate = async () => {
    setIsValidating(true)
    try {
      await onValidate()
    } finally {
      setIsValidating(false)
    }
  }

  const handleRequestHumanReview = async () => {
    setIsRequestingReview(true)
    try {
      await onRequestHumanReview()
    } finally {
      setIsRequestingReview(false)
    }
  }

  const status = validationResult?.status || 'idle'

  if (status === 'idle') {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl">
          <Shield className="h-8 w-8 text-blue-500" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Compliance Review</h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            We&apos;ll review your organization details against our Acceptable Use Policy.
          </p>
        </div>

        <Button 
          onClick={handleValidate}
          loading={isValidating || loading}
          size="lg"
          className="px-8"
        >
          {isValidating ? 'Starting Review...' : 'Start Review'}
        </Button>
      </div>
    )
  }

  if (status === 'validating') {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
        
        <div className="space-y-3">
          <StatusBadge status="validating" />
          <h3 className="text-lg font-semibold">Review in Progress</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Reviewing your organization details for compliance...
          </p>
        </div>

        <div className="max-w-xs mx-auto space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
          </div>
          <p className="text-xs text-gray-500">This usually takes 10-30 seconds</p>
        </div>
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        
        <div className="space-y-3">
          <StatusBadge status="approved" />
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">
            Review Complete
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Your organization meets our Acceptable Use Policy requirements.
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4 max-w-md mx-auto">
          <div className="flex items-center justify-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Ready to proceed with account setup
            </span>
          </div>
        </div>

        {validationResult?.submittedAt && (
          <p className="text-xs text-gray-500">
            Completed at {validationResult.submittedAt.toLocaleTimeString()}
          </p>
        )}
      </div>
    )
  }

  if (status === 'uncertain') {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl">
          <HelpCircle className="h-8 w-8 text-yellow-500" />
        </div>
        
        <div className="space-y-3">
          <StatusBadge status="uncertain" />
          <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
            Manual Review Required
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Our team needs to manually review your organization details.
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 max-w-md mx-auto">
          <div className="flex items-start space-x-2">
            <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Review timeline: 1-2 business days
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                We&apos;ll notify you via email when the review is complete.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        
        <div className="space-y-3">
          <StatusBadge status="denied" />
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">
            Review Attention Needed
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Our review identified some details that need clarification.
          </p>
        </div>

        {validationResult?.reason && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-md mx-auto">
            <div className="text-left">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Reason for review:
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {validationResult.reason}
              </p>
            </div>
          </div>
        )}

        <div className="border-t pt-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Don&apos;t worry – this happens sometimes. Our team can provide a manual review.
          </p>
          
          <Button
            variant="outline"
            onClick={handleRequestHumanReview}
            loading={isRequestingReview}
            className="px-6"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {isRequestingReview ? 'Requesting...' : 'Request Human Review'}
          </Button>
        </div>
      </div>
    )
  }

  return null
}