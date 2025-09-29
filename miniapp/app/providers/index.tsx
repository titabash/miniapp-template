'use client'

import React from 'react'
import { AuthProvider } from './auth-provider'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return <AuthProvider>{children}</AuthProvider>
}
