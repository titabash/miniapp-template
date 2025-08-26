import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Server Functions のマップ
const serverFunctions = {};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Server Functions エンドポイント（/actions）のみを処理
  if (req.method === "POST" && url.pathname === "/actions") {
    try {
      const body = await req.json();
      const { functionName, args } = body;

      if (
        !functionName ||
        !serverFunctions[functionName as keyof typeof serverFunctions]
      ) {
        return new Response(JSON.stringify({ error: "Invalid function" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const serverFunction =
        serverFunctions[functionName as keyof typeof serverFunctions];
      const result = await (serverFunction as any)(...(args || []));

      return new Response(JSON.stringify({ result }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Server Function Error:", error);
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error
              ? error.message
              : "Server function execution failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // HTMLリクエストの場合は、index.htmlファイルを直接返す
  if (
    req.method === "GET" &&
    (url.pathname === "/" || req.headers.get("accept")?.includes("text/html"))
  ) {
    try {
      const indexPath = resolve(process.cwd(), "index.html");
      const htmlContent = await readFile(indexPath, "utf-8");

      return new Response(htmlContent, {
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "no-cache",
        },
      });
    } catch (error) {
      console.error("Failed to read index.html:", error);
      return new Response(
        "<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Failed to load page</h1></body></html>",
        {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }
      );
    }
  }

  // 静的ファイル（CSS、JS等）のリクエストは404を返してViteに処理させる
  return new Response(null, {
    status: 404,
  });
}
