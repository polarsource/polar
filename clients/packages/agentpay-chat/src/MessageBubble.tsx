"""
Message bubble component
"""

import React from 'react';
import { cn } from './utils';
import type { AgentPayMessage } from './types';

interface MessageBubbleProps {
  message: AgentPayMessage;
  primaryColor?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  primaryColor = '#3b82f6',
}) => {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2',
          isUser
            ? 'rounded-br-none text-white'
            : 'rounded-bl-none bg-gray-100 text-gray-900'
        )}
        style={isUser ? { backgroundColor: primaryColor } : undefined}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={cn(
            'mt-1 text-xs',
            isUser ? 'text-white/70' : 'text-gray-500'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
};
