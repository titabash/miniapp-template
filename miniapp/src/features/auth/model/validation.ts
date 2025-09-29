/**
 * 認証フォームのバリデーションロジック
 * FSD準拠: ビジネスロジックをmodelレイヤーに分離
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * ログインフォームのバリデーション
 */
export function validateLoginForm(
  email: string,
  password: string
): ValidationResult {
  // 必須項目チェック
  if (!email || !password) {
    return {
      isValid: false,
      error: 'メールアドレスとパスワードを入力してください',
    }
  }

  // メールアドレスの形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: '有効なメールアドレスを入力してください',
    }
  }

  // パスワードの最小長チェック（オプション）
  if (password.length < 6) {
    return {
      isValid: false,
      error: 'パスワードは6文字以上で入力してください',
    }
  }

  return {
    isValid: true,
  }
}

/**
 * メールアドレスの形式チェック
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * パスワードの強度チェック（将来の拡張用）
 */
export function checkPasswordStrength(
  password: string
): 'weak' | 'medium' | 'strong' {
  if (password.length < 8) return 'weak'

  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasNonAlphanumeric = /[^a-zA-Z0-9]/.test(password)

  const strength = [
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    hasNonAlphanumeric,
  ].filter(Boolean).length

  if (strength <= 2) return 'weak'
  if (strength === 3) return 'medium'
  return 'strong'
}
