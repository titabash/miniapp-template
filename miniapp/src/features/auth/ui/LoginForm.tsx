"use client";

import React, { useState } from "react";
import { Alert } from "@/shared/ui/alert";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { validateLoginForm } from "../model/validation";
import type { useMiniAppAuth } from "../model/useAuth";

interface LoginFormProps {
  auth: ReturnType<typeof useMiniAppAuth>;
}

/**
 * ログインフォームコンポーネント
 * FSD準拠: UIコンポーネントをfeatures/auth/uiに配置
 */
export function LoginForm({ auth }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // バリデーション（modelレイヤーのロジックを使用）
    const validation = validateLoginForm(email, password);
    if (!validation.isValid) {
      setError(validation.error || "入力内容を確認してください");
      return;
    }

    setIsLoading(true);
    try {
      await auth.login(email, password);
      // 成功時は自動的に認証状態が更新されて画面が切り替わる
    } catch (error) {
      setError((error as Error).message || "ログインに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">ログイン</CardTitle>
          <CardDescription className="text-center">
            メールアドレスとパスワードを入力してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <p className="text-sm">{error}</p>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  ログイン中...
                </span>
              ) : (
                "ログイン"
              )}
            </Button>

            {/* postMessage認証の状態表示 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">
                  または
                </span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                親アプリケーションからの自動ログインを待機中...
              </p>
              <div className="mt-2 animate-pulse">
                <div className="h-1 w-full bg-gray-200 rounded"></div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}