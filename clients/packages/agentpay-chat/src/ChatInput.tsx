"""
Chat input component
"""

import React, { useState, useRef } from 'react';
import { cn } from './utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  primaryColor?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  primaryColor = '#3b82f6',
}) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;

    onSend(message);
    setMessage('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 p-4"
    >
      <div className="flex items-end space-x-2">
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2"
          style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        />
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className={cn(
            'rounded-lg p-2 text-white transition-colors',
            !message.trim() || disabled
              ? 'cursor-not-allowed opacity-50'
              : 'hover:opacity-90'
          )}
          style={{ backgroundColor: primaryColor }}
          aria-label="Send message"
        >
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
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </form>
  );
};
