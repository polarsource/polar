import { createPendingActionStore } from '@/utils/pendingAction'
import { z } from 'zod'

export const AGENT_CLAIM_RESUME_PARAM = 'resume_claim'

export const pendingAgentClaims = createPendingActionStore({
  keyPrefix: 'polar:agent-claim:confirm:v1:',
  resumeParam: AGENT_CLAIM_RESUME_PARAM,
  payloadSchema: z.string(),
})
