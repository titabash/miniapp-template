// app/_client-logging.tsx
// 目的：ブラウザ（フロント）のログ/エラーを漏れなく「プレフィックス付き」で出力する“完全版”を1ファイルに集約。
// 特徴：
// - console.* を一度だけパッチ（既存コードは一切変更不要。layout.tsx にこのコンポーネントを1行差すだけ）
// - 実行時エラー（window.onerror）と未処理Promise拒否（window.unhandledrejection）を一括捕捉
// - Fast Refresh / 再マウントでも多重登録されないようにグローバルフラグでガード
// - UIを描画しない常駐コンポーネント（return null）
// 設定：
// - 環境変数 NEXT_PUBLIC_LOG_PREFIX を設定（例："[WEAVO]"）。未設定なら "[APP]"。
// - 追加の制御が必要なら、下の「カスタマイズ項目」を編集してください。

"use client";

import { useEffect } from "react";

//========================
// カスタマイズ項目
//========================

// 1) ブラウザ側コンソールログの先頭に付ける共通プレフィックス。
//    - デプロイ時は .env / .env.local 等に NEXT_PUBLIC_LOG_PREFIX を設定する想定。
//    - 未設定時は "[APP]" を利用する。
const ENV_PREFIX: string =
  process.env.NEXT_PUBLIC_LOG_PREFIX ?? "[WEAVO MiniApp]";

// 2) console.log をどのレベルで扱うか（"info" 推奨）。
//    - "info" にすると log と info がまとまり、集計・運用が楽になります。
const MAP_LOG_TO: "info" | "debug" | "warn" | "error" = "info";

// 3) タイムスタンプのフォーマット（ISO8601固定が扱いやすい）
function nowISO(): string {
  return new Date().toISOString();
}

// 4) 多重登録ガードで使うグローバルキー（衝突回避のため一意な名前にする）
const FLAG_KEY = "__CLIENT_LOGGING_INSTALLED__";
const UNINSTALL_KEY = "__CLIENT_LOGGING_UNINSTALL__";

// 5) 開発中に一時的に特定の機能を OFF にしたい場合（true にする）
//    - 本番では基本すべて true のままで OK。
const ENABLE_CONSOLE_PATCH = true;
const ENABLE_WINDOW_ONERROR = true;
const ENABLE_WINDOW_UNHANDLED_REJECTION = true;

//========================
// 実装
//========================

/**
 * console.* をプレフィックス付きで包むパッチを適用し、アンインストーラを返す。
 * - 多重パッチ防止のため、呼び出し側でガードを必ず掛けること。
 */
function installConsolePatch(prefix: string): () => void {
  // 元の console 関数を保持（this バインド済み）
  const original = {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    log: console.log.bind(console),
  };

  // 指定レベルで出力するラッパー関数を作る
  const wrap =
    (level: "debug" | "info" | "warn" | "error") =>
    (...args: unknown[]) => {
      const head = `${nowISO()} ${prefix} [${level.toUpperCase()}]`;
      switch (level) {
        case "error":
          original.error(head, ...args);
          break;
        case "warn":
          original.warn(head, ...args);
          break;
        case "debug":
          original.debug(head, ...args);
          break;
        case "info":
        default:
          original.info(head, ...args);
          break;
      }
    };

  // 実際にパッチ適用（console.log は MAP_LOG_TO にマップ）
  console.debug = wrap("debug");
  console.info = wrap("info");
  console.warn = wrap("warn");
  console.error = wrap("error");
  console.log = wrap(MAP_LOG_TO);

  // 起動確認ログ（これ以降のログはすべてプレフィックス付きで出力）
  console.info(`${nowISO()} ${prefix} [INFO] Client console patched`);

  // 解除関数（必要に応じて呼べるように返す）
  return () => {
    console.debug = original.debug;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    console.log = original.log;
  };
}

/**
 * window.onerror / window.unhandledrejection を登録し、アンインストーラを返す。
 */
function installGlobalErrorHandlers(prefix: string): () => void {
  // イベントハンドラ：実行時エラー
  const onError = (event: ErrorEvent) => {
    // event.error が Error オブジェクトのこともある（対応ブラウザ）
    console.error(
      `${nowISO()} ${prefix} [client-events] [ERROR] window.onerror`,
      {
        message: event?.message,
        filename: event?.filename,
        lineno: event?.lineno,
        colno: event?.colno,
        error: event?.error,
      }
    );
  };

  // イベントハンドラ：未処理の Promise 拒否
  const onRejection = (event: PromiseRejectionEvent) => {
    console.error(
      `${nowISO()} ${prefix} [client-events] [ERROR] window.unhandledrejection`,
      {
        reason: event?.reason, // 例：Error / string / any
      }
    );
  };

  if (ENABLE_WINDOW_ONERROR) {
    window.addEventListener("error", onError);
  }
  if (ENABLE_WINDOW_UNHANDLED_REJECTION) {
    window.addEventListener("unhandledrejection", onRejection);
  }

  // 起動確認
  console.info(
    `${nowISO()} ${prefix} [client-events] [INFO] Error handlers installed`
  );

  // 解除関数
  return () => {
    if (ENABLE_WINDOW_ONERROR) {
      window.removeEventListener("error", onError);
    }
    if (ENABLE_WINDOW_UNHANDLED_REJECTION) {
      window.removeEventListener("unhandledrejection", onRejection);
    }
  };
}

/**
 * UI を描画しない常駐クライアントコンポーネント。
 * - 初回マウントで console パッチ + グローバルエラーハンドラを一度だけセット。
 * - Fast Refresh / 再マウントでも多重登録されないようにガード。
 * - 開発時に動的アンインストールしたい場合に備え、window にアンインストーラを残す。
 */
export default function ClientLogging(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // すでに導入済みなら何もしない
    const anyWindow = window as any;
    if (anyWindow[FLAG_KEY]) {
      return;
    }

    anyWindow[FLAG_KEY] = true;

    const uninstallers: Array<() => void> = [];

    // 1) console.* をパッチ
    if (ENABLE_CONSOLE_PATCH) {
      const unpatch = installConsolePatch(ENV_PREFIX);
      uninstallers.push(unpatch);
    }

    // 2) window.onerror / unhandledrejection を登録
    const unreg = installGlobalErrorHandlers(ENV_PREFIX);
    uninstallers.push(unreg);

    // アンインストール API（任意でデバッグに使う）
    anyWindow[UNINSTALL_KEY] = () => {
      while (uninstallers.length) {
        const fn = uninstallers.pop();
        try {
          fn?.();
        } catch (e) {
          // 解除時の例外は握りつぶす
        }
      }
      anyWindow[FLAG_KEY] = false;
      console.info(
        `${nowISO()} ${ENV_PREFIX} [INFO] Client logging uninstalled`
      );
    };

    // アンマウント時（通常は呼ばれない想定。次のマウントでガードが効く）
    return () => {
      // アンインストールは基本的にしない（Fast Refresh 対策）。
      // 本当に解除したいときは window.__CLIENT_LOGGING_UNINSTALL__() を手動で呼ぶ。
    };
  }, []);

  return null; // 画面には何も描画しない
}
