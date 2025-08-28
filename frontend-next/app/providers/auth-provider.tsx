"use client";

import React from "react";
import { useMiniAppAuth } from "@/features/auth";
import { Alert } from "@/shared/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useMiniAppAuth();

  // エラー時のリトライハンドラー
  const handleRetry = async () => {
    try {
      await auth.refreshAuth();
    } catch (error) {
      console.error("認証リトライ失敗:", error);
    }
  };

  // ページリロードハンドラー
  const handleReload = () => {
    window.location.reload();
  };

  // 認証エラーの場合はエラーページを表示
  if (auth.authStatus === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">認証エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="font-medium">認証に失敗しました</p>
                  <p className="text-sm">{auth.authMessage}</p>
                </div>
                <div className="flex flex-col space-y-2">
                  <Button onClick={handleRetry} variant="outline" size="sm">
                    再試行
                  </Button>
                  <Button onClick={handleReload} variant="outline" size="sm">
                    ページを再読み込み
                  </Button>
                </div>
              </div>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 認証処理中の場合はスピナーを表示
  if (auth.authStatus === "checking" || auth.authStatus === "authenticating") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-sm text-gray-600">{auth.authMessage}</p>
        </div>
      </div>
    );
  }

  // idle状態の場合は認証待機画面を表示
  if (auth.authStatus === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>認証待機中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                認証情報を待機しています...
              </p>
              <div className="animate-pulse">
                <div className="h-2 w-full bg-gray-200 rounded"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 認証成功の場合は子コンポーネントを表示
  return <>{children}</>;
}