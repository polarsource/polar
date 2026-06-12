import React from 'react'

// The chat kit's own domain model — deliberately free of API schemas.
// Adapters map their backend data into these shapes.

export interface ChatMessage {
  id: string
  body: string | null
  // ISO timestamp.
  createdAt: string
  // Which side of the conversation: 'self' renders right-aligned in the
  // accent bubble, 'other' renders left-aligned.
  sender: 'self' | 'other'
}

export interface ChatAttachment {
  id: string
  messageId: string | null
  name: string
  mimeType: string
  size: number
  // Download link; rows render as plain text when absent.
  href?: string
}

export interface ChatUploadHandle {
  promise: Promise<{ id: string }>
  abort: () => void
}

// Upload policy and mechanics, injected by the adapter.
export interface ChatUploader {
  upload: (
    file: File,
    onProgress: (fraction: number) => void,
  ) => ChatUploadHandle
  isAccepted: (file: File) => boolean
  // `accept` attribute for the file picker.
  accept: string
  maxFileSize: number
  maxFiles: number
}

// Per-message rendering override: `undefined` falls through to the default
// bubble, `null` hides the message, a node replaces the row entirely.
export type RenderChatMessage = (
  message: ChatMessage,
) => React.ReactNode | null | undefined
