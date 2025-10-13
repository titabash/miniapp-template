#!/usr/bin/env bash

# miniapp-template 初期化スクリプト
# agent/ と miniapp/ の依存関係を並列でインストール

set -e  # エラーが発生したら即座に終了

# カラーコード定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# プロジェクトルートディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Miniapp Template 初期化${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# agent/ と miniapp/ の存在確認
if [ ! -d "$PROJECT_ROOT/agent" ]; then
  echo -e "${RED}❌ エラー: agent/ ディレクトリが見つかりません${NC}"
  exit 1
fi

if [ ! -d "$PROJECT_ROOT/miniapp" ]; then
  echo -e "${RED}❌ エラー: miniapp/ ディレクトリが見つかりません${NC}"
  exit 1
fi

# pnpm の存在確認
if ! command -v pnpm &> /dev/null; then
  echo -e "${RED}❌ エラー: pnpm がインストールされていません${NC}"
  echo -e "${YELLOW}インストール方法: npm install -g pnpm${NC}"
  exit 1
fi

echo -e "${BLUE}📦 依存関係のインストールを開始...${NC}"
echo ""

# 並列でpnpm installを実行
echo -e "${YELLOW}[agent] pnpm install を実行中...${NC}"
(
  cd "$PROJECT_ROOT/agent" && pnpm install
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ [agent] インストール完了${NC}"
  else
    echo -e "${RED}❌ [agent] インストール失敗${NC}"
    exit 1
  fi
) &
AGENT_PID=$!

echo -e "${YELLOW}[miniapp] pnpm install を実行中...${NC}"
(
  cd "$PROJECT_ROOT/miniapp" && pnpm install
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ [miniapp] インストール完了${NC}"
  else
    echo -e "${RED}❌ [miniapp] インストール失敗${NC}"
    exit 1
  fi
) &
MINIAPP_PID=$!

echo ""

# 両方のプロセスの完了を待機
AGENT_EXIT_CODE=0
MINIAPP_EXIT_CODE=0

wait $AGENT_PID || AGENT_EXIT_CODE=$?
wait $MINIAPP_PID || MINIAPP_EXIT_CODE=$?

echo ""
echo -e "${BLUE}========================================${NC}"

# 結果レポート
if [ $AGENT_EXIT_CODE -eq 0 ] && [ $MINIAPP_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ 初期化が正常に完了しました！${NC}"
  echo ""
  echo -e "${BLUE}次のステップ:${NC}"
  echo -e "  1. 環境変数を設定: ${YELLOW}.env${NC} ファイルを作成"
  echo -e "  2. PocketBaseを起動: ${YELLOW}docker compose up -d${NC}"
  echo -e "  3. Agent APIを起動: ${YELLOW}cd agent && pnpm run dev${NC}"
  echo -e "  4. Miniappを起動: ${YELLOW}cd miniapp && pnpm run dev${NC}"
  echo ""
  echo -e "${BLUE}========================================${NC}"
  exit 0
else
  echo -e "${RED}❌ 初期化中にエラーが発生しました${NC}"
  echo ""
  if [ $AGENT_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}  • agent/ のインストールが失敗 (終了コード: $AGENT_EXIT_CODE)${NC}"
  fi
  if [ $MINIAPP_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}  • miniapp/ のインストールが失敗 (終了コード: $MINIAPP_EXIT_CODE)${NC}"
  fi
  echo ""
  echo -e "${BLUE}========================================${NC}"
  exit 1
fi
