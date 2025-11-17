"""
AgentPay Chat Widget Types
"""

export interface AgentPayMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  intent?: string;
  metadata?: Record<string, any>;
}

export interface AgentPayConversation {
  id: string;
  session_id: string;
  status: 'active' | 'completed' | 'abandoned';
  stage: 'discovery' | 'browsing' | 'consideration' | 'checkout' | 'completed';
  context: Record<string, any>;
  hesitation_signals: number;
}

export interface AgentPayConfig {
  organizationId: string;
  agentType?: 'sales' | 'support' | 'payment';
  apiEndpoint?: string;
  enableStreaming?: boolean;
  enableTypingIndicator?: boolean;
}

export interface StreamChunk {
  type: 'thinking' | 'intent' | 'action' | 'tool' | 'content' | 'done' | 'error';
  content: string;
  chunk?: string;
  metadata?: Record<string, any>;
}
