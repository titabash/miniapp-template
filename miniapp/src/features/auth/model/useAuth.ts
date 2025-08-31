"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { pb } from "@/shared/lib/pocketbase";
import type { User, AuthStatus, PostMessageData } from "@/entities/user";

interface UseAuthReturn {
  authStatus: AuthStatus;
  authMessage: string;
  isAuthenticated: boolean;
  user: User | null;
  getCurrentUser: () => User | null;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
}

// PocketBaseレコードからUserオブジェクトに変換
interface PocketBaseRecord {
  id: string;
  email?: string;
  emailVisibility?: boolean;
  verified?: boolean;
  created?: string;
  updated?: string;
  name?: string;
  avatar?: string;
  [key: string]: unknown;
}

function convertToUser(record: PocketBaseRecord | null): User {
  if (!record) {
    throw new Error('Record is null');
  }
  return {
    id: record.id,
    email: record.email || "",
    emailVisibility: record.emailVisibility ?? false,
    verified: record.verified ?? false,
    created: record.created || "",
    updated: record.updated || "",
    name: record.name || "",
    avatar: record.avatar || "",
  };
}

export function useMiniAppAuth(): UseAuthReturn {
  // Next.js ハイドレーション対策: 初期状態を統一
  const [authStatus, setAuthStatus] = useState<AuthStatus>("idle");
  const [authMessage, setAuthMessage] = useState<string>("認証情報を待機しています...");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 認証処理用のAbortControllerを管理
  const authControllerRef = useRef<AbortController | null>(null);

  // 即座に確認できる実行中フラグ（useRefで同期的に管理）
  const isAuthenticatingRef = useRef<boolean>(false);

  // デバウンス用のタイマー管理
  const debounceTimerRef = useRef<number | null>(null);

  // 親アプリへの通知
  const notifyParentReady = useCallback(() => {
    const parentWindow = (window as Window & { parent: Window }).parent;
    if (parentWindow && parentWindow !== window) {
      console.log("[useMiniAppAuth] 親アプリにminiapp_ready通知を送信");
      parentWindow.postMessage(
        {
          type: "miniapp_ready",
          data: {
            timestamp: new Date().toISOString(),
          },
        },
        "*"
      );
    }
  }, []);

  // 認証成功時の親への通知
  const notifyAuthSuccess = useCallback(
    (userData: { id: string; email: string }) => {
      const parentWindow = (window as Window & { parent: Window }).parent;
      if (parentWindow && parentWindow !== window) {
        console.log("[useMiniAppAuth] 親アプリに認証成功を通知");
        parentWindow.postMessage(
          {
            type: "auth_result",
            data: {
              success: true,
              user: userData,
            },
          },
          "*"
        );
      }
    },
    []
  );

  // 認証失敗時の親への通知
  const notifyAuthFailure = useCallback((error: string) => {
    const parentWindow = (window as Window & { parent: Window }).parent;
    if (parentWindow && parentWindow !== window) {
      console.log("[useMiniAppAuth] 親アプリに認証失敗を通知");
      parentWindow.postMessage(
        {
          type: "auth_result",
          data: {
            success: false,
            error,
          },
        },
        "*"
      );
    }
  }, []);

  // PocketBase authStoreの状態監視（核心機能）
  useEffect(() => {
    console.log("[useMiniAppAuth] authStore監視を開始");

    // Cookie から認証情報を復元（Next.js ベストプラクティス）
    // クライアント側でのみ実行
    if (typeof window !== "undefined") {
      try {
        pb.authStore.loadFromCookie(document.cookie);
        console.log("[useMiniAppAuth] Cookie から認証情報を復元:", {
          isValid: pb.authStore.isValid,
          hasToken: !!pb.authStore.token,
        });
      } catch (error) {
        console.warn("[useMiniAppAuth] Cookie からの認証情報復元に失敗:", error);
      }
    }

    const updateAuthState = (isValid: boolean, record: PocketBaseRecord | null) => {
      // 現在の状態を取得（クロージャの問題を回避）
      setAuthStatus((currentAuthStatus) => {
        console.log("[useMiniAppAuth] authStore.onChange発火:", {
          isValid,
          hasRecord: !!record,
          hasToken: !!pb.authStore.token,
          currentAuthStatus,
          timestamp: new Date().toISOString(),
        });

        setIsAuthenticated(isValid);

        if (record && isValid) {
          const userData = convertToUser(record);
          setUser(userData);
          setAuthMessage("認証済み");
          return "success";
        } else {
          // 認証処理中または既に認証成功している場合はidleに戻さない
          if (currentAuthStatus !== "authenticating" && currentAuthStatus !== "success") {
            setUser(null);
            setAuthMessage("認証情報を待機しています...");
            return "idle";
          }
          // 状態を維持
          console.log("[useMiniAppAuth] 認証状態を維持:", currentAuthStatus);
          return currentAuthStatus;
        }
      });
    };

    // 初期状態を設定
    updateAuthState(pb.authStore.isValid, pb.authStore.model);

    // authStore変更を監視（単一の真実の源）
    const unsubscribe = pb.authStore.onChange((_, record) => {
      updateAuthState(pb.authStore.isValid, record);
      
      // Cookie に認証情報を保存（Next.js ベストプラクティス）
      // クライアント側でのみ実行
      if (typeof window !== "undefined") {
        try {
          const cookieOptions = {
            httpOnly: false, // クライアント側でアクセス可能
            secure: location.protocol === 'https:',
            sameSite: 'strict' as const,
            maxAge: 7 * 24 * 60 * 60, // 7日間
          };
          document.cookie = pb.authStore.exportToCookie(cookieOptions);
        } catch (error) {
          console.warn("[useMiniAppAuth] Cookie への認証情報保存に失敗:", error);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 初期認証検証（一度だけ実行）
  useEffect(() => {
    console.log("[useMiniAppAuth] 初期認証状態を検証中...");

    const validateAndRefresh = async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection("users").authRefresh();
          console.log("[useMiniAppAuth] 初期認証検証成功");
        } catch (error) {
          console.log(
            "[useMiniAppAuth] 初期認証検証失敗 - authStore をクリア:",
            error
          );
          pb.authStore.clear(); // 無効な場合はクリア
        }
      }
    };

    validateAndRefresh();
  }, []);

  // PocketBaseエラーの適切な処理
  const handlePocketBaseError = useCallback((error: unknown): string => {
    const pocketBaseError = error as {
      status?: number;
      response?: { message?: string };
      message?: string;
    };

    if (pocketBaseError?.status) {
      switch (pocketBaseError.status) {
        case 400:
          return "リクエストが無効です";
        case 401:
          return "認証情報が正しくありません";
        case 403:
          return "アクセスが拒否されました";
        case 404:
          return "ユーザーが見つかりません";
        case 429:
          return "リクエストが多すぎます。しばらく待ってから再試行してください";
        case 500:
          return "サーバー内部エラーが発生しました";
        default:
          return (
            pocketBaseError.response?.message || "サーバーエラーが発生しました"
          );
      }
    }

    return pocketBaseError?.message || "認証エラーが発生しました";
  }, []);

  // 手動リフレッシュ機能
  const handleRefreshAuth = useCallback(async () => {
    if (!pb.authStore.isValid) {
      throw new Error("認証されていません");
    }

    try {
      await pb.collection("users").authRefresh();
      console.log("[useMiniAppAuth] 手動リフレッシュ成功");
    } catch (error) {
      console.error("[useMiniAppAuth] 手動リフレッシュ失敗:", error);
      pb.authStore.clear();
      throw error;
    }
  }, []);

  // 手動ログイン機能（自動サインアップなし）
  const handleManualLogin = useCallback(async (email: string, password: string) => {
    console.log("[useMiniAppAuth] 手動ログイン開始:", { email });

    // 認証中状態を設定
    setAuthStatus("authenticating");
    setAuthMessage("ログイン中...");

    try {
      // PocketBaseで直接認証実行（サインインのみ）
      const authData = await pb
        .collection("users")
        .authWithPassword(email, password);

      console.log("[useMiniAppAuth] 手動ログイン成功:", {
        email: authData.record.email,
        authStoreIsValid: pb.authStore.isValid,
        hasToken: !!pb.authStore.token,
      });

      // authStore.onChangeが自動で状態を更新するため手動setStateは不要

      // 親ページに認証成功を通知
      notifyAuthSuccess({
        id: authData.record.id,
        email: authData.record.email,
      });
    } catch (error: unknown) {
      const errorMessage = handlePocketBaseError(error);
      console.error("[useMiniAppAuth] 手動ログイン失敗:", error);

      // エラー状態を設定（自動サインアップは行わない）
      setAuthStatus("error");
      setAuthMessage(`ログイン失敗: ${errorMessage}`);

      // 親ページに認証失敗を通知
      notifyAuthFailure(errorMessage);

      // エラーを再スロー（呼び出し元でキャッチできるように）
      throw new Error(errorMessage);
    }
  }, [notifyAuthSuccess, notifyAuthFailure, handlePocketBaseError]);

  // 初期化処理
  useEffect(() => {
    const controller = new AbortController();

    const initialize = async () => {
      if (!isInitialized && !controller.signal.aborted) {
        setIsInitialized(true);
        console.log("[useMiniAppAuth] 初期化完了");

        // 初期化完了と同時に親アプリに通知
        notifyParentReady();
      }
    };

    initialize();

    return () => {
      controller.abort();
    };
  }, [isInitialized, notifyParentReady]);

  // 認証処理ハンドラー（PocketBaseクライアント使用）
  const handleAuthentication = useCallback(
    async (email: string, password: string) => {
      // 同期的な多重実行防止チェック
      if (isAuthenticatingRef.current) {
        console.log(
          "[useMiniAppAuth] 認証処理がすでに実行中のため、新しい認証要求をスキップ（同期チェック）"
        );
        return;
      }

      console.log("[useMiniAppAuth] 認証処理開始:", { email });

      // 前回の認証処理をキャンセル
      if (authControllerRef.current) {
        authControllerRef.current.abort();
      }

      // 新しいAbortControllerを作成
      const authController = new AbortController();
      authControllerRef.current = authController;

      // 実行中フラグを即座に設定（同期）
      isAuthenticatingRef.current = true;

      // 認証中状態を設定
      setAuthStatus("authenticating");
      setAuthMessage("認証中...");

      try {
        // 認証処理がキャンセルされていないかチェック
        if (authController.signal.aborted) {
          return;
        }

        // PocketBaseで直接認証実行
        const authData = await pb
          .collection("users")
          .authWithPassword(email, password);

        // 認証処理がキャンセルされていないかチェック
        if (authController.signal.aborted) {
          return;
        }

        console.log("[useMiniAppAuth] 認証成功:", {
          email: authData.record.email,
          authStoreIsValid: pb.authStore.isValid,
          hasToken: !!pb.authStore.token,
        });

        // authStore.onChangeが自動で状態を更新するため手動setStateは不要

        // 親ページに認証成功を通知
        notifyAuthSuccess({
          id: authData.record.id,
          email: authData.record.email,
        });
      } catch (error: unknown) {
        // 認証処理がキャンセルされていた場合は何もしない
        if (authController.signal.aborted) {
          return;
        }

        console.log(
          "[useMiniAppAuth] 認証失敗 - 自動ユーザー作成を試行:",
          error
        );

        // 認証失敗時に自動ユーザー作成を試行（ミニアプリの設計思想）
        setAuthMessage("新しいユーザーを作成中...");

        try {
          // キャンセルチェック
          if (authController.signal.aborted) {
            return;
          }

          console.log("[useMiniAppAuth] ユーザー作成開始:", { email });

          // PocketBaseでユーザー作成
          const userData = await pb.collection("users").create({
            email,
            password,
            passwordConfirm: password,
            emailVisibility: true,
          });

          console.log("[useMiniAppAuth] ユーザー作成成功:", userData.email);

          // キャンセルチェック
          if (authController.signal.aborted) {
            return;
          }

          // ユーザー作成後、すぐに認証実行
          const authData = await pb
            .collection("users")
            .authWithPassword(email, password);

          console.log("[useMiniAppAuth] ユーザー作成後認証成功:", {
            email: authData.record.email,
            authStoreIsValid: pb.authStore.isValid,
            hasToken: !!pb.authStore.token,
          });

          // 親ページに認証成功を通知
          notifyAuthSuccess({
            id: authData.record.id,
            email: authData.record.email,
          });
        } catch (createError: unknown) {
          // キャンセルチェック
          if (authController.signal.aborted) {
            return;
          }

          const createErrorMessage = handlePocketBaseError(createError);
          console.log(
            "[useMiniAppAuth] ユーザー作成または再認証失敗:",
            createError
          );

          // ユーザー作成も失敗した場合のエラーハンドリング
          setAuthStatus("error");
          setAuthMessage(`認証失敗: ${createErrorMessage}`);

          // 親ページに認証失敗を通知
          notifyAuthFailure(createErrorMessage);
        }
      } finally {
        // 実行中フラグを即座にリセット（同期）
        isAuthenticatingRef.current = false;

        // 完了した認証処理のコントローラーをクリア
        if (authControllerRef.current === authController) {
          authControllerRef.current = null;
        }
      }
    },
    [notifyAuthSuccess, notifyAuthFailure, handlePocketBaseError]
  );

  // デバウンスされた認証処理
  const debouncedHandleAuthentication = useCallback(
    (email: string, password: string) => {
      // 既存のタイマーをクリア
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 50ms後に実行（短時間の連続呼び出しを防ぐ）
      debounceTimerRef.current = window.setTimeout(() => {
        handleAuthentication(email, password);
      }, 50);
    },
    [handleAuthentication]
  );

  // postMessage監視（一度だけ実行）
  useEffect(() => {
    const controller = new AbortController();

    const handleMessage = async (event: Event) => {
      if (controller.signal.aborted) return;

      const messageEvent = event as MessageEvent<PostMessageData>;
      const data = messageEvent.data;

      console.log("[useMiniAppAuth] postMessage受信:", {
        origin: messageEvent.origin,
        type: data?.type,
        hasData: !!data?.data,
        isCurrentlyAuthenticating: isAuthenticatingRef.current,
        timestamp: new Date().toISOString(),
      });

      if (data && data.type === "auth") {
        // 既に認証済みの場合は処理をスキップ
        if (isAuthenticated) {
          console.log(
            "[useMiniAppAuth] 既に認証済みのため認証メッセージをスキップ:",
            {
              isAuthenticated,
              authStoreIsValid: pb.authStore.isValid,
            }
          );
          return;
        }

        // 同期的チェック（最優先）
        if (isAuthenticatingRef.current) {
          console.log(
            "[useMiniAppAuth] 認証処理中のため新しい認証メッセージをスキップ（同期チェック）"
          );
          return;
        }

        console.log(
          "[useMiniAppAuth] 認証メッセージを受信 - デバウンス認証処理を開始:",
          {
            hasEmail: !!data.data?.email,
            hasPassword: !!data.data?.password,
          }
        );
        const { email, password } = data.data;
        debouncedHandleAuthentication(email, password);
      }
    };

    console.log("[useMiniAppAuth] postMessageリスナーを登録");
    window.addEventListener("message", handleMessage);

    return () => {
      controller.abort();
      window.removeEventListener("message", handleMessage);

      // デバウンスタイマーをクリア
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [debouncedHandleAuthentication, isAuthenticated]);

  // 現在のユーザー取得
  const getCurrentUserLocal = useCallback((): User | null => {
    return user;
  }, [user]);

  // ログアウト
  const logout = useCallback(() => {
    // 進行中の認証処理をキャンセル
    if (authControllerRef.current) {
      authControllerRef.current.abort();
      authControllerRef.current = null;
    }

    // 実行中フラグを即座にリセット（同期）
    isAuthenticatingRef.current = false;

    // PocketBase authStoreをクリア
    pb.authStore.clear();

    console.log("[useMiniAppAuth] ログアウト実行");
  }, []);

  // 戻り値をメモ化してパフォーマンス向上
  return useMemo(
    () => ({
      authStatus,
      authMessage,
      isAuthenticated,
      user,
      getCurrentUser: getCurrentUserLocal,
      logout,
      refreshAuth: handleRefreshAuth,
      login: handleManualLogin,
    }),
    [
      authStatus,
      authMessage,
      isAuthenticated,
      user,
      getCurrentUserLocal,
      logout,
      handleRefreshAuth,
      handleManualLogin,
    ]
  );
}
