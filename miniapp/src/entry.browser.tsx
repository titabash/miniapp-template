import { createRoot } from "react-dom/client";
import "./index.css";
import { createFromReadableStream } from "@vitejs/plugin-rsc/rsc";

declare global {
  interface Window {
    callServerFunction: <T = any>(
      functionName: string,
      ...args: any[]
    ) => Promise<T>;
  }
}

window.callServerFunction = async <T = any,>(
  functionName: string,
  ...args: any[]
): Promise<T> => {
  const response = await fetch("/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ functionName, args }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Server function call failed");
  }

  return data.result;
};

function setupErrorHandling() {
  window.addEventListener("error", (event) => {
    const errorMessage = `${event.error?.name || "Error"}: ${event.error?.message || event.message}`;
    window.parent.postMessage(
      {
        type: "iframe_error",
        error: errorMessage,
        details: {
          message: event.error?.message || event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        },
      },
      "*"
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    window.parent.postMessage(
      {
        type: "iframe_error",
        error: `Unhandled Promise Rejection: ${event.reason}`,
        details: { reason: event.reason, type: "unhandledrejection" },
      },
      "*"
    );
  });
}

async function initializeApp() {
  try {
    const rscResponse = await fetch(window.location.href + ".rsc");

    if (!rscResponse.ok) {
      throw new Error(
        `Failed to fetch RSC stream: ${rscResponse.status} ${rscResponse.statusText}`
      );
    }

    if (!rscResponse.body) {
      throw new Error("No response body received from RSC stream");
    }

    const root = await createFromReadableStream(rscResponse.body);
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Root container element not found");
    }

    const reactRoot = createRoot(container);
    reactRoot.render(root as any);
  } catch (error) {
    console.error("Failed to initialize React app:", error);
    showErrorFallback(error);
    // エラーハンドリングは setupErrorHandling() で自動処理される
  }
}

function showErrorFallback(error: unknown) {
  const container = document.getElementById("root");
  if (container) {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: sans-serif;">
        <h1>アプリケーションの初期化に失敗しました</h1>
        <p>エラー: ${error instanceof Error ? error.message : "Unknown error"}</p>
        <button onclick="window.location.reload()" style="margin-top: 10px; padding: 10px; cursor: pointer;">
          再読み込み
        </button>
      </div>
    `;
  }
}

setupErrorHandling();
initializeApp();
