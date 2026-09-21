'use client'

import { getQueryClient } from '@/query'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

export const Providers = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={getQueryClient()}>
    {children}
  </QueryClientProvider>
)
