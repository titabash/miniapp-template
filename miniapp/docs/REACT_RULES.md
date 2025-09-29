# React 実装ベストプラクティス（2025年版）

本ドキュメントは、**React 19** と **Next.js 最新版** を前提に、AIエージェントや開発者がプロジェクトに実装する際に従うべきベストプラクティスを体系化したものです。ここに記載する内容はあくまで要点であり、**最新情報は必ず Context7 を利用して公式一次情報を確認してください**。

---

## 1. 副作用 (`useEffect`) を最小化する

- **参照先**: [You Might Not Need an Effect (react.dev)](https://react.dev/learn/you-might-not-need-an-effect)
- **ガイドライン**:
  - 派生データや計算可能な値は **`useEffect` ではなく計算式や props で表現**する。
  - `useEffect` は **外部システム同期**（DOM API、イベント購読、ネットワーク要求など）に限定する。
  - 不要な Effect を避けることで、**コードの予測可能性とパフォーマンスが向上**する。

- **Context7 確認**:
  - `Summarize “You Might Not Need an Effect” with before/after code. use context7`

---

## 2. React Compiler（自動メモ化）を活用する

- **参照先**: [React Compiler (react.dev)](https://react.dev/learn/react-compiler)
- **ガイドライン**:
  - React Compiler が自動で再レンダリング最適化を行うため、`useMemo` / `useCallback` / `React.memo` の多用は不要になる。
  - **Next.js**: `next.config.js` に `reactCompiler: true` を追加して有効化する。
  - **Vite / Babel**: `babel-plugin-react-compiler` をインストールし、Babel プラグインの **最初に配置**すること。
  - **メリット**: 開発者の手動最適化コストを削減し、長期的な保守性を高める。

- **Context7 確認**:
  - `Show minimal configs for enabling React Compiler in Next.js and Vite. use context7`

---

## 3. React Server Components (RSC) と Server Functions

- **参照先**:
  - [Server and Client Components (Next.js Docs)](https://nextjs.org/docs/app/building-your-application/rendering/server-and-client-components)
  - [Updating Data with Server Functions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions)

- **ガイドライン**:
  - **データ取得と描画はサーバ (RSC)** を基本とする。これにより、初期表示の高速化とSEO最適化を実現できる。
  - **状態変更（POST/PUT/DELETEなど）は Server Functions** で処理し、セキュリティやデータ一貫性を担保する。
  - **クライアントコンポーネントは最小化**し、UIインタラクションのみを担当させる。
  - **設計原則**: 「取得＝サーバ」「変更＝サーバ」「操作＝クライアント最小」

- **Context7 確認**:
  - `Provide a pattern that uses Server Components for data and Server Functions for mutations. use context7`

---

## 4. Hooks の基本規則

- **参照先**: [Rules of Hooks (react.dev)](https://react.dev/reference/react/hooks#rules-of-hooks)
- **ガイドライン**:
  - Hooks は **トップレベルでのみ呼び出す**。条件分岐やループの中で呼び出してはいけない。
  - カスタムフックを作成して処理を共通化し、再利用性を高める。
  - `useState` や `useReducer` はアプリケーションのローカルステート管理に利用し、グローバルステートには RSC やサーバキャッシュを優先する。

- **Context7 確認**:
  - `Summarize the official Rules of Hooks with examples. use context7`

---

## まとめ

- **`useEffect` を乱用せず、外部同期に限定する。**
- **React Compiler を導入して手動最適化の負債を削減する。**
- **RSC + Server Functions を基盤とし、クライアントは最小化する。**
- **Hooks の規則を守り、予測可能で安定したコンポーネント設計を行う。**

---

## 利用上の注意

- 本ドキュメントは実装ガイドラインの要約であり、**常に Context7 を用いて公式一次情報を確認してください**。
- React 19 / Next.js は仕様変更や RC が頻繁に登場するため、**最新情報の確認が必須**です。
