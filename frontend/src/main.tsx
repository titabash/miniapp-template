import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Server Functions 用のグローバル関数を定義
declare global {
  interface Window {
    callServerFunction: <T = any>(functionName: string, ...args: any[]) => Promise<T>
  }
}

// Server Functions 呼び出し用のヘルパー関数
const ACTIONS_ENDPOINT = '/actions'

window.callServerFunction = async <T = any>(functionName: string, ...args: any[]): Promise<T> => {
  const response = await fetch(ACTIONS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ functionName, args })
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || 'Server function call failed')
  }
  
  return data.result
}

// グローバルエラーハンドリング
window.addEventListener('error', (event) => {
  const errorMessage = `${event.error?.name || 'Error'}: ${event.error?.message || event.message}
Location: ${event.filename}:${event.lineno}:${event.colno}
Stack: ${event.error?.stack || 'No stack trace'}`;

  window.parent.postMessage({
    type: 'iframe_error',
    error: errorMessage,
    details: {
      message: event.error?.message || event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    }
  }, '*');
});

// Promise rejection エラー
window.addEventListener('unhandledrejection', (event) => {
  const errorMessage = `Unhandled Promise Rejection: ${event.reason}`;
  
  window.parent.postMessage({
    type: 'iframe_error',
    error: errorMessage,
    details: {
      reason: event.reason,
      type: 'unhandledrejection'
    }
  }, '*');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
