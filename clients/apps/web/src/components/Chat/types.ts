import React from 'react'

export interface ChatMessage {
  id: string
  body: string | null
  createdAt: string
  sender: 'self' | 'other'
}

export interface ChatAttachment {
  id: string
  messageId: string | null
  name: string
  mimeType: string
  size: number
  href?: string
}

export interface ChatUploadHandle {
  promise: Promise<{ id: string }>
  abort: () => void
}

export interface ChatUploader {
  upload: (
    file: File,
    onProgress: (fraction: number) => void,
  ) => ChatUploadHandle
  isAccepted: (file: File) => boolean
  accept: string
  maxFileSize: number
  maxFiles: number
}

export type RenderChatMessage = (
  message: ChatMessage,
) => React.ReactNode | null | undefined
