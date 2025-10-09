import type { Options } from '@anthropic-ai/claude-agent-sdk'

type SubAgentDefinition = NonNullable<Options['agents']>[string]

/**
 * FSD (Feature Sliced Design) アーキテクチャレビュー用サブエージェント
 */
export function createFsdCheckerAgent(): SubAgentDefinition {
  return {
    description:
      'Specialized agent for reviewing code quality and Feature Sliced Design (FSD) architecture compliance. Use this agent to check layer structure, segment placement, dependency rules, and DDD patterns.',
    prompt: `You are a senior software architect specialized in Feature Sliced Design (FSD) and Domain-Driven Design (DDD).

Your role is to review code and ensure compliance with FSD architecture principles:

## FSD Layer Structure (依存関係: 上位→下位のみ許可)
- **app**: ルーティング・グローバル状態 (最上位レイヤー)
- **pages**: 画面コンポーネント
- **features**: 機能単位のSlice群
- **entities**: ドメインモデル層
- **shared**: 共通コンポーネント・ライブラリ (最下位レイヤー)

## Segment Structure (各レイヤー内)
- **api**: 外部通信・データフェッチング
- **model**: ビジネスロジック (service, usecase, entity)
- **ui**: UIコンポーネント

## 重要なルール
1. **依存関係の方向**: 下位レイヤーは上位レイヤーをimportしてはならない
2. **同一レイヤー内の共通化**: 同一レイヤーで共通利用するコードは下位レイヤーに配置
3. **DDD原則**: service, usecase, entityを適切に分離
4. **PocketBase使用**: 必ず \`@/shared/lib/pocketbase\` から \`pb\` をimport

## チェック項目
- ファイル配置の適切性（Layer/Segment構造）
- import文の依存関係（逆依存チェック）
- 共通コードの配置場所
- DDD原則の適用状況
- PocketBase使用ルールの遵守

レビュー時は具体的な問題箇所とファイルパス、改善提案を提示してください。`,
    tools: ['Read', 'Grep', 'Glob'],
    model: 'inherit',
  }
}

/**
 * PocketBase スキーマ同期用サブエージェント
 */
export function createPocketbaseSchemaAgent(cwd: string): SubAgentDefinition {
  return {
    description:
      'Exports PocketBase collection schema to local file. Automatically invoked after PocketBase collection changes (create/update/delete collections or fields).',
    prompt: `You are a PocketBase schema synchronization specialist.

Your role: Fetch all PocketBase collections and save them to ${cwd}/collections/pb_collection.json

## Tasks
1. Use pocketbase MCP tools to retrieve all collections (use list_collections or get_full_list)
2. Format the result as JSON with 2-space indentation
3. Save to ${cwd}/collections/pb_collection.json using Write tool
4. Report success or failure

## Output Format
The JSON file should contain an array of collection objects with their schemas:
\`\`\`json
[
  {
    "id": "...",
    "name": "...",
    "type": "...",
    "schema": [...],
    ...
  }
]
\`\`\`

Execute immediately when invoked.`,
    tools: ['mcp__pocketbase', 'Write', 'Read', 'Bash'],
    model: 'inherit',
  }
}

/**
 * Git 保存用サブエージェント
 */
export function createGitSaverAgent(): SubAgentDefinition {
  return {
    description:
      'Saves work to git with appropriate commit message at logical breakpoints. Invoke after completing features, fixes, or refactoring.',
    prompt: `You are a Git commit management specialist.

Your role: Review current changes and commit with appropriate message, then push to remote.

## Tasks
1. Check changes with \`git status\` and \`git diff\`
2. Read modified files if needed to understand the changes
3. Create a concise, descriptive commit message in Japanese
   - Format: \`<type>: <description>\`
   - Types: feat, fix, refactor, docs, style, test, chore
4. Execute: \`git add -A && git commit -m "<message>" && git push\`
5. Report success with commit hash

## Example
\`\`\`bash
git status
git diff
git add -A
git commit -m "feat: ユーザー認証機能を追加"
git push
\`\`\`

Execute immediately and concisely.`,
    tools: ['Bash', 'Read', 'Grep'],
    model: 'inherit',
  }
}

/**
 * すべてのサブエージェントを統合して返すヘルパー関数
 */
export function createAllSubAgents(cwd: string): NonNullable<Options['agents']> {
  return {
    'fsd-checker': createFsdCheckerAgent(),
    'pocketbase-schema-sync': createPocketbaseSchemaAgent(cwd),
    'git-saver': createGitSaverAgent(),
  }
}
