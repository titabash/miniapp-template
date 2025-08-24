# AIエージェント開発ガイドライン

## 概要

このプロジェクトでは、**Mastra Core**を使用してAIエージェントとワークフローを構築します。Mastraサーバーは使用せず、`@mastra/core`ライブラリを直接利用してエージェントシステムを開発します。

## 重要な注意事項

### 🔥 Context7による最新ドキュメント取得を強く推奨

**AIエージェント開発前に必ずContext7を使用してMastraの最新ドキュメントを取得してください。**

```bash
# Context7を使用してMastraの最新情報を取得
mcp__context7__resolve-library-id --libraryName="mastra"
mcp__context7__get-library-docs --context7CompatibleLibraryID="/mastra-ai/mastra" --topic="agents workflows core"
```

Mastraは活発に開発されているフレームワークのため、APIや実装方法が頻繁に変更されます。Context7を使用することで、常に最新のベストプラクティスに基づいた開発が可能になります。

### 🔧 環境変数について

AIエージェント開発で使用する以下の環境変数は既に設定済みです：

- `OPENAI_API_KEY`: OpenAI API アクセス用（エージェントのLLMモデル使用）
- `FAL_KEY`: fal.ai API アクセス用（画像・動画生成ツール使用時）
- その他のAPI キー: 各種ツール統合用

**注意**: 環境変数は既に設定済みのため、新たに `.env` ファイルなどを作成する必要はありません。

## アーキテクチャ原則

### 1. Mastra Coreの使用

- **@mastra/core**のみを使用（Mastraサーバーは利用しない）
- エージェント、ワークフロー、ツールをコードベースで定義
- TypeScript strict modeで型安全性を確保

### 2. 設計原則

```typescript
// ✅ 推奨：@mastra/coreを使用
import { Agent } from "@mastra/core/agent";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { Mastra } from "@mastra/core/mastra";

// ❌ 非推奨：Mastraサーバーの使用
// import { MastraServer } from "@mastra/server";
```

## エージェント開発パターン

### 1. 基本エージェント定義

```typescript
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const researchAgent = new Agent({
  name: "research-agent",
  description: "データ収集と分析を行うエージェント",
  instructions: `
    あなたは専門的なリサーチエージェントです。
    - 正確な情報収集を行う
    - 分析結果を構造化して提供する
    - 信頼できるソースのみを使用する
  `,
  model: openai("gpt-4o"),
});
```

### 2. ツール統合エージェント

```typescript
import { createTool } from "@mastra/core/tools";

const searchTool = createTool({
  id: "web-search",
  description: "ウェブ検索を実行",
  inputSchema: z.object({
    query: z.string(),
  }),
  execute: async ({ context }) => {
    // 検索ロジック実装
  },
});

export const researchAgentWithTools = new Agent({
  name: "research-agent-with-tools",
  instructions: "ツールを使用してリサーチを行うエージェント",
  model: openai("gpt-4o"),
  tools: {
    webSearch: searchTool,
  },
});
```

### 3. ワークフロー統合エージェント

```typescript
export const comprehensiveAgent = new Agent({
  name: "comprehensive-agent",
  description: "複合的なタスクを実行するエージェント",
  instructions: "ワークフローとツールを組み合わせて複雑なタスクを実行",
  model: openai("gpt-4o"),
  tools: {
    searchTool,
  },
  workflows: {
    analysisWorkflow,
  },
});
```

## ワークフロー開発パターン

### 1. 基本ワークフロー

```typescript
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const dataProcessingStep = createStep({
  id: "data-processing",
  description: "データを処理して分析結果を生成",
  inputSchema: z.object({
    rawData: z.string(),
  }),
  outputSchema: z.object({
    processedData: z.object({
      summary: z.string(),
      insights: z.array(z.string()),
    }),
  }),
  execute: async ({ inputData }) => {
    // データ処理ロジック
    return {
      processedData: {
        summary: "分析結果のサマリー",
        insights: ["洞察1", "洞察2"],
      },
    };
  },
});

export const dataAnalysisWorkflow = createWorkflow({
  id: "data-analysis-workflow",
  inputSchema: z.object({
    rawData: z.string(),
  }),
  outputSchema: z.object({
    processedData: z.object({
      summary: z.string(),
      insights: z.array(z.string()),
    }),
  }),
})
  .then(dataProcessingStep)
  .commit();
```

### 2. エージェント統合ワークフロー

```typescript
const aiAnalysisStep = createStep({
  id: "ai-analysis",
  description: "AIエージェントによる分析",
  inputSchema: z.object({
    data: z.string(),
  }),
  outputSchema: z.object({
    analysis: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("analysisAgent");
    const result = await agent.generate([
      {
        role: "user",
        content: `次のデータを分析してください: ${inputData.data}`,
      },
    ]);

    return {
      analysis: result.text,
    };
  },
});

export const aiPoweredWorkflow = createWorkflow({
  id: "ai-powered-workflow",
  inputSchema: z.object({
    data: z.string(),
  }),
  outputSchema: z.object({
    analysis: z.string(),
  }),
})
  .then(aiAnalysisStep)
  .commit();
```

### 3. 並列実行ワークフロー

```typescript
const step1 = createStep({
  id: "parallel-step-1",
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ result1: z.string() }),
  execute: async ({ inputData }) => ({ result1: "結果1" }),
});

const step2 = createStep({
  id: "parallel-step-2",
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ result2: z.string() }),
  execute: async ({ inputData }) => ({ result2: "結果2" }),
});

const combineStep = createStep({
  id: "combine-results",
  inputSchema: z.object({
    result1: z.string(),
    result2: z.string(),
  }),
  outputSchema: z.object({
    combined: z.string(),
  }),
  execute: async ({ inputData }) => ({
    combined: `${inputData.result1} + ${inputData.result2}`,
  }),
});

export const parallelWorkflow = createWorkflow({
  id: "parallel-workflow",
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ combined: z.string() }),
})
  .parallel([step1, step2])
  .then(combineStep)
  .commit();
```

## Mastraインスタンス管理

### 1. 基本設定

```typescript
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";

export const mastra = new Mastra({
  agents: {
    researchAgent,
    analysisAgent,
    comprehensiveAgent,
  },
  workflows: {
    dataAnalysisWorkflow,
    aiPoweredWorkflow,
    parallelWorkflow,
  },
  logger: new PinoLogger({
    name: "MiniApp-AI-System",
    level: "info",
  }),
});
```

### 2. 実行パターン

```typescript
// エージェント実行
async function runAgent() {
  const agent = mastra.getAgent("researchAgent");
  const result = await agent.generate([
    {
      role: "user",
      content: "最新のAI技術トレンドについて調査してください",
    },
  ]);

  console.log(result.text);
}

// ワークフロー実行
async function runWorkflow() {
  const workflow = mastra.getWorkflow("dataAnalysisWorkflow");
  const run = workflow.createRun();

  const result = await run.start({
    inputData: {
      rawData: "分析対象のデータ",
    },
  });

  console.log(result);
}
```

## エラーハンドリング

### 1. エージェント実行エラー

```typescript
async function safeAgentExecution() {
  try {
    const agent = mastra.getAgent("researchAgent");
    const result = await agent.generate([
      { role: "user", content: "質問内容" }
    ]);
    return result;
  } catch (error) {
    console.error("エージェント実行エラー:", error);
    // フォールバック処理
    return { text: "エラーが発生しました。後ほど再試行してください。" };
  }
}
```

### 2. ワークフロー実行エラー

```typescript
async function safeWorkflowExecution() {
  try {
    const workflow = mastra.getWorkflow("dataAnalysisWorkflow");
    const run = workflow.createRun();
    const result = await run.start({ inputData: { rawData: "data" } });
    return result;
  } catch (error) {
    console.error("ワークフロー実行エラー:", error);
    // エラー処理とリトライ機能
    throw new Error("ワークフロー処理に失敗しました");
  }
}
```

## プロジェクト構造

```
src/
├── ai-system/
│   ├── agents/
│   │   ├── research-agent.ts
│   │   ├── analysis-agent.ts
│   │   └── index.ts
│   ├── workflows/
│   │   ├── data-analysis-workflow.ts
│   │   ├── ai-powered-workflow.ts
│   │   └── index.ts
│   ├── tools/
│   │   ├── search-tool.ts
│   │   ├── analysis-tool.ts
│   │   └── index.ts
│   ├── mastra.ts           # Mastraインスタンス設定
│   └── types.ts            # 型定義
```

## ベストプラクティス

### 1. 型安全性

```typescript
// Zodスキーマで入出力を厳密に定義
const StrictInputSchema = z.object({
  userId: z.string().uuid(),
  content: z.string().min(1).max(1000),
  timestamp: z.string().datetime(),
});

const StrictOutputSchema = z.object({
  result: z.string(),
  confidence: z.number().min(0).max(1),
  metadata: z.object({
    processedAt: z.string().datetime(),
    model: z.string(),
  }),
});
```

### 2. ログ戦略

```typescript
const step = createStep({
  id: "logged-step",
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();

    logger.info("ステップ開始", { inputData });

    try {
      const result = await processData(inputData);
      logger.info("ステップ完了", { result });
      return result;
    } catch (error) {
      logger.error("ステップエラー", { error });
      throw error;
    }
  },
});
```

### 3. テスト戦略

```typescript
import { describe, it, expect } from "vitest";

describe("ResearchAgent", () => {
  it("should generate research results", async () => {
    const agent = mastra.getAgent("researchAgent");
    const result = await agent.generate([
      { role: "user", content: "テスト質問" }
    ]);

    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
  });
});

describe("DataAnalysisWorkflow", () => {
  it("should process data successfully", async () => {
    const workflow = mastra.getWorkflow("dataAnalysisWorkflow");
    const run = workflow.createRun();

    const result = await run.start({
      inputData: { rawData: "テストデータ" }
    });

    expect(result.processedData).toBeDefined();
    expect(result.processedData.summary).toBeDefined();
  });
});
```

## 開発フロー

### 1. 新機能追加

1. **Context7でMastraの最新ドキュメントを確認**
2. 要件分析とアーキテクチャ設計
3. エージェント/ワークフロー実装
4. 単体テスト作成
5. 統合テスト実行
6. ドキュメント更新

### 2. デバッグ手順

1. ログレベルを"debug"に設定
2. ステップごとの入出力を確認
3. エージェント応答の詳細分析
4. エラーハンドリングの改善

## Context7統合

### 最新情報の取得方法

開発前に必ず以下を実行してください：

```bash
# 1. Mastraライブラリの解決
mcp__context7__resolve-library-id --libraryName="mastra"

# 2. 最新ドキュメントの取得
mcp__context7__get-library-docs \
  --context7CompatibleLibraryID="/mastra-ai/mastra" \
  --tokens=15000 \
  --topic="agents workflows core tools"

# 3. 特定機能の詳細情報取得
mcp__context7__get-library-docs \
  --context7CompatibleLibraryID="/mastra-ai/mastra" \
  --tokens=10000 \
  --topic="streaming memory networks"
```

### 継続的な学習

- 週1回のContext7による最新情報チェック
- 新機能追加前の必須確認
- アップデート時の既存コード互換性確認

## まとめ

このガイドラインに従うことで、効率的で保守性の高いAIエージェントシステムを構築できます。**特にContext7を活用した最新ドキュメントの取得は、Mastraの急速な進化に対応するために不可欠です。**

開発中に不明な点があれば、必ずContext7で最新のドキュメントを確認し、ベストプラクティスに従って実装を進めてください。
