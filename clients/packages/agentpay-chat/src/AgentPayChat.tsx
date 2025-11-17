"""
AgentPay Chat Widget - Main Component

A conversational commerce chat widget that connects to AgentPay API.

Features:
- Real-time WebSocket connection
- Server-Sent Events streaming
- Typing indicators
- Message history
- Mobile responsive
- Customizable appearance
"""

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { cn } from './utils';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { useAgentPayWebSocket } from './hooks/useAgentPayWebSocket';
import type { AgentPayMessage, AgentPayConfig } from './types';

export interface AgentPayChatProps {
  /**
   * Organization ID (required)
   */
  organizationId: string;

  /**
   * Agent type (sales, support, payment)
   * @default "sales"
   */
  agentType?: 'sales' | 'support' | 'payment';

  /**
   * API endpoint
   * @default "http://localhost:8000/v1/agent"
   */
  apiEndpoint?: string;

  /**
   * Position of chat button
   * @default "bottom-right"
   */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

  /**
   * Primary color for branding
   * @default "#3b82f6"
   */
  primaryColor?: string;

  /**
   * Initial message from agent
   */
  welcomeMessage?: string;

  /**
   * Callback when checkout is generated
   */
  onCheckout?: (checkoutUrl: string) => void;

  /**
   * Callback when conversation starts
   */
  onConversationStart?: (conversationId: string) => void;

  /**
   * Enable streaming responses
   * @default true
   */
  enableStreaming?: boolean;

  /**
   * Enable typing indicators
   * @default true
   */
  enableTypingIndicator?: boolean;
}

export const AgentPayChat: React.FC<AgentPayChatProps> = ({
  organizationId,
  agentType = 'sales',
  apiEndpoint = 'http://localhost:8000/v1/agent',
  position = 'bottom-right',
  primaryColor = '#3b82f6',
  welcomeMessage = "Hi! I'm here to help you find what you're looking for. How can I assist you today?",
  onCheckout,
  onConversationStart,
  enableStreaming = true,
  enableTypingIndicator = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AgentPayMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { sendMessage, isConnected, isTyping } = useAgentPayWebSocket({
    apiEndpoint,
    conversationId,
    onMessage: handleIncomingMessage,
    enableStreaming,
  });

  // Create conversation on first open
  useEffect(() => {
    if (isOpen && !conversationId) {
      createConversation();
    }
  }, [isOpen, conversationId]);

  // Add welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0 && welcomeMessage) {
      setMessages([
        {
          id: 'welcome',
          role: 'agent',
          content: welcomeMessage,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [isOpen, messages.length, welcomeMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function createConversation() {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiEndpoint}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          organization_id: organizationId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create conversation');

      const data = await response.json();
      setConversationId(data.id);
      onConversationStart?.(data.id);
    } catch (error) {
      console.error('Error creating conversation:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleIncomingMessage(message: AgentPayMessage) {
    setMessages((prev) => [...prev, message]);

    // Check for checkout URL
    if (message.metadata?.checkout_url && onCheckout) {
      onCheckout(message.metadata.checkout_url);
    }
  }

  async function handleSendMessage(content: string) {
    if (!conversationId || !content.trim()) return;

    // Add user message to UI
    const userMessage: AgentPayMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Send via WebSocket or HTTP
    try {
      if (enableStreaming && isConnected) {
        // Use WebSocket
        sendMessage(content);
      } else {
        // Use HTTP with streaming
        await sendMessageHTTP(content);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: 'agent',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }

  async function sendMessageHTTP(content: string) {
    if (!conversationId) return;

    setIsLoading(true);

    try {
      if (enableStreaming) {
        // Use SSE streaming endpoint
        const response = await fetch(
          `${apiEndpoint}/conversations/${conversationId}/messages/stream`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, context: {} }),
          }
        );

        if (!response.ok) throw new Error('Failed to send message');

        // Read SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let streamingMessage: AgentPayMessage = {
          id: `agent_${Date.now()}`,
          role: 'agent',
          content: '',
          timestamp: new Date().toISOString(),
        };

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content') {
                  streamingMessage.content += parsed.chunk || parsed.content;
                  setMessages((prev) => {
                    const others = prev.filter((m) => m.id !== streamingMessage.id);
                    return [...others, { ...streamingMessage }];
                  });
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      } else {
        // Use regular POST
        const response = await fetch(
          `${apiEndpoint}/conversations/${conversationId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, context: {} }),
          }
        );

        if (!response.ok) throw new Error('Failed to send message');

        const data = await response.json();
        setMessages((prev) => [...prev, data.message]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      {/* Chat Button */}
      <Dialog.Trigger asChild>
        <button
          className={cn(
            'fixed z-50 h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-110',
            positionClasses[position]
          )}
          style={{ backgroundColor: primaryColor }}
          aria-label="Open chat"
        >
          <svg
            className="mx-auto h-6 w-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </button>
      </Dialog.Trigger>

      {/* Chat Window */}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex h-[600px] w-full max-w-[400px] flex-col rounded-lg bg-white shadow-2xl',
            position.includes('right') ? 'right-4' : 'left-4',
            position.includes('bottom') ? 'bottom-4' : 'top-4'
          )}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between rounded-t-lg p-4 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-white/20" />
              <div>
                <Dialog.Title className="font-semibold">AgentPay</Dialog.Title>
                <p className="text-xs opacity-90">
                  {isConnected ? 'Online' : 'Connecting...'}
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="rounded p-1 hover:bg-white/20" aria-label="Close">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          {/* Messages */}
          <ScrollArea.Root className="flex-1 overflow-hidden">
            <ScrollArea.Viewport className="h-full w-full p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    primaryColor={primaryColor}
                  />
                ))}
                {enableTypingIndicator && isTyping && (
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                    <span>Agent is typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              className="flex touch-none select-none p-0.5"
              orientation="vertical"
            >
              <ScrollArea.Thumb className="relative flex-1 rounded-full bg-gray-300" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          {/* Input */}
          <ChatInput
            onSend={handleSendMessage}
            disabled={!conversationId || isLoading}
            primaryColor={primaryColor}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
