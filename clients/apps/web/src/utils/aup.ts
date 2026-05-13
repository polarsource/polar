import { z } from 'zod'

export const AUP_VERDICTS = ['APPROVE', 'DENY', 'CLARIFY'] as const
export type AupVerdict = (typeof AUP_VERDICTS)[number]

export const answerEvaluationSchema = z.object({
  question_id: z.string().min(1).max(64),
  is_relevant: z.boolean(),
  reason: z.string().max(300).nullable(),
})
export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema>

export interface FollowUpQuestion {
  id: string
  label: string
  description?: string | null
  type: 'text' | 'choice'
  required: boolean
  placeholder?: string | null
  max_length?: number | null
  options?: string[] | null
}

export const QUESTIONS_BY_TRIGGER = {
  ai_content_generation: [
    {
      id: 'ai_content_type',
      label: 'What type of content does your AI generate?',
      description: 'e.g. images, video, written articles, code, music, voice.',
      type: 'text',
      required: true,
      max_length: 300,
    },
    {
      id: 'content_safety_measures',
      label: 'What safety measures prevent disallowed outputs?',
      description:
        'Describe concrete moderation tools, prompt restrictions, or human review steps that block NSFW, copyrighted, or otherwise policy-violating content.',
      type: 'text',
      required: true,
      max_length: 500,
    },
  ],
  kids_directed: [
    {
      id: 'kids_audience',
      label: 'Who is the actual buyer of your product?',
      description:
        'Even if the content is for children, the purchase typically needs to be made by an adult or institution.',
      type: 'choice',
      required: true,
      options: [
        'Parents or guardians',
        'Teachers or educational institutions',
        'Children directly',
      ],
    },
  ],
  financial_tools: [
    {
      id: 'financial_execution',
      label: 'Does your product execute trades or only display information?',
      type: 'choice',
      required: true,
      options: [
        'Information and analytics only',
        'Executes or facilitates actual trades / investments',
      ],
    },
  ],
  security_tools: [
    {
      id: 'security_authorization',
      label:
        'What controls ensure customers only test systems they own or have permission to test?',
      description:
        'e.g. mandatory ownership attestation, scope restrictions, allow-listed targets.',
      type: 'text',
      required: true,
      max_length: 500,
    },
  ],
  crypto_platform: [
    {
      id: 'crypto_execution',
      label: 'Does your product execute or broker crypto transactions?',
      type: 'choice',
      required: true,
      options: [
        'Tracking and analytics only',
        'Executes or brokers token transactions',
      ],
    },
  ],
  medical_legal_content: [
    {
      id: 'medical_legal_scope',
      label: 'Does your product offer specific medical or legal advice?',
      description:
        'e.g. diagnosis, treatment plans, legal strategy, or actionable legal guidance — as opposed to general reference, how-to content, or domain-specific information.',
      type: 'choice',
      required: true,
      options: [
        'General reference, education, or information only',
        'Personalized diagnosis, treatment plans, or legal strategy',
      ],
    },
  ],
  lead_generation: [
    {
      id: 'outreach_controls',
      label:
        'What controls prevent automated bulk outreach or non-consensual messaging?',
      description:
        'e.g. rate limiting, opt-in / consent verification, suppression lists, sender authentication.',
      type: 'text',
      required: true,
      max_length: 500,
    },
  ],
  vpn_proxy: [
    {
      id: 'vpn_usage_controls',
      label:
        'What measures prevent use of your service to access illegal or geo-restricted content?',
      description:
        'e.g. terms enforcement, blocked destinations, abuse reporting.',
      type: 'text',
      required: true,
      max_length: 500,
    },
  ],
  ebook_pdf_guide: [
    {
      id: 'ebook_authorship',
      label: 'Is the content human-authored or AI-generated?',
      type: 'choice',
      required: true,
      options: [
        'Human-authored',
        'AI-generated with human editing',
        'Fully AI-generated',
      ],
    },
  ],
  directory_platform: [
    {
      id: 'directory_model',
      label: 'How does your directory or listing platform work?',
      type: 'choice',
      required: true,
      options: [
        'Curated resource we maintain',
        'Marketplace where third parties list and sell their own products',
      ],
    },
  ],
  preorder_early_access: [
    {
      id: 'preorder_status',
      label: 'Does a working version of your product already exist?',
      type: 'choice',
      required: true,
      options: [
        'Yes — fully working, customers get access immediately',
        'Partial — customers get access to the current state',
        'Not yet — pre-order for a future release',
      ],
    },
    {
      id: 'preorder_timeline',
      label: 'What is the expected delivery timeline?',
      description:
        'e.g. "available immediately", "30 days from purchase", "rolling release within 90 days".',
      type: 'text',
      required: true,
      max_length: 200,
    },
  ],
  coaching_consulting: [
    {
      id: 'service_model',
      label:
        'Is your product self-serve software, or does it connect customers to humans?',
      type: 'choice',
      required: true,
      options: [
        'Self-serve software or content',
        'Connects customers with human coaches / consultants / service providers',
      ],
    },
  ],
} satisfies Record<string, FollowUpQuestion[]>

export type FollowUpTrigger = keyof typeof QUESTIONS_BY_TRIGGER

export const FOLLOW_UP_TRIGGERS = Object.keys(QUESTIONS_BY_TRIGGER) as [
  FollowUpTrigger,
  ...FollowUpTrigger[],
]
