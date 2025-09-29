import { redirect } from 'next/navigation'

export default function RootPage() {
  // "/" にアクセスした場合は "/home" にリダイレクト
  redirect('/home')
}
