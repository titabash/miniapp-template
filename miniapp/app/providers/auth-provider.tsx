'use client'

import React from 'react'
import { useMiniAppAuth, LoginForm } from '@/features/auth'
import { Alert, AlertTitle, AlertDescription } from '@/shared/ui/alert'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useMiniAppAuth()

  // エラー時のリトライハンドラー
  const handleRetry = async () => {
    try {
      await auth.refreshAuth()
    } catch (error) {
      console.error('認証リトライ失敗:', error)
    }
  }

  // ページリロードハンドラー
  const handleReload = () => {
    window.location.reload()
  }

  // 認証エラーの場合はエラーページを表示
  if (auth.authStatus === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">認証エラー</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>認証に失敗しました</AlertTitle>
              <AlertDescription>{auth.authMessage}</AlertDescription>
            </Alert>
            <div className="flex flex-col space-y-2">
              <Button onClick={handleRetry} variant="outline">
                再試行
              </Button>
              <Button onClick={handleReload} variant="outline">
                ページを再読み込み
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 認証処理中の場合はスピナーを表示
  if (auth.authStatus === 'checking' || auth.authStatus === 'authenticating') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
          <p className="text-sm text-gray-600">{auth.authMessage}</p>
        </div>
      </div>
    )
  }

  // idle状態の場合はログイン画面を表示
  if (auth.authStatus === 'idle') {
    return <LoginForm auth={auth} />
  }

  // 認証成功の場合は子コンポーネントを表示
  return <>{children}</>
}
