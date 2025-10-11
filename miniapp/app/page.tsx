import { HomePage } from '@/pages'

export default function RootPage() {
  // "/" がホーム画面として直接 HomePage を表示
  // AuthProvider により、未認証時は自動的にログインフォームが表示されます
  return <HomePage />
}
