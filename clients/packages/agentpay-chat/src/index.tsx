"""
AgentPay Chat Widget - Main Export

Usage:
  import { AgentPayChat } from '@agentpay/chat';

  <AgentPayChat
    organizationId="your-org-id"
    agentType="sales"
    primaryColor="#3b82f6"
    onCheckout={(url) => window.location.href = url}
  />
"""

export { AgentPayChat } from './AgentPayChat';
export type { AgentPayChatProps } from './AgentPayChat';
export type { AgentPayMessage, AgentPayConversation, AgentPayConfig } from './types';
