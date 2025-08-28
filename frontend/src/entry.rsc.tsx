const serverFunctions = {};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith(".rsc")) {
    try {
      const React = await import("react");
      const { renderToReadableStream } = await import("@vitejs/plugin-rsc/rsc");
      const { default: App } = await import("./App.tsx");
      
      const appElement = React.createElement(App);
      const rscStream = renderToReadableStream(appElement);
      
      return new Response(rscStream, {
        headers: {
          "Content-Type": "text/x-component;charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    } catch (error) {
      console.error("RSC Stream Error:", error);
      return new Response("RSC Stream Error", { status: 500 });
    }
  }

  if (req.method === "POST" && url.pathname === "/actions") {
    try {
      const body = await req.json();
      const { functionName, args } = body;

      if (!functionName || !serverFunctions[functionName as keyof typeof serverFunctions]) {
        return new Response(JSON.stringify({ error: "Invalid function" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const serverFunction = serverFunctions[functionName as keyof typeof serverFunctions];
      const result = await (serverFunction as any)(...(args || []));

      return new Response(JSON.stringify({ result }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Server Function Error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Server function execution failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  if (req.method === "GET" && (url.pathname === "/" || req.headers.get("accept")?.includes("text/html"))) {
    return generateHtmlResponse();
  }

  return new Response(null, { status: 404 });
}

async function generateHtmlResponse(): Promise<Response> {
  try {
    const isDev = process.env.NODE_ENV !== 'production';
    let scriptSrc = '/src/entry.browser.tsx';
    let cssLinks = '';

    if (!isDev) {
      // @ts-ignore - viteRsc API is not typed
      const bootstrapScriptContent = await import.meta.viteRsc?.loadBootstrapScriptContent('index');
      
      if (bootstrapScriptContent) {
        scriptSrc = `data:text/javascript;base64,${btoa(bootstrapScriptContent)}`;
      } else {
        const assets = await loadAssetsFromManifest();
        scriptSrc = assets.scriptSrc;
        cssLinks = assets.cssLinks;
      }
    }

    const htmlShell = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
    ${cssLinks}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${scriptSrc}"></script>
  </body>
</html>`;

    return new Response(htmlShell, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error('Failed to generate HTML:', error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function loadAssetsFromManifest(): Promise<{ scriptSrc: string; cssLinks: string }> {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  
  const manifestPath = resolve(process.cwd(), 'dist/rsc/__vite_rsc_assets_manifest.js');
  const manifestContent = await readFile(manifestPath, 'utf-8');
  
  const manifestData = manifestContent.replace('export default ', '').replace(/;\s*$/, '');
  const manifest = JSON.parse(manifestData);
  
  const jsMatch = manifest.bootstrapScriptContent.match(/import\("([^"]+)"\)/);
  const scriptSrc = jsMatch ? jsMatch[1] : '/src/entry.browser.tsx';
  
  const clientDeps = Object.values(manifest.clientReferenceDeps)[0] as any;
  const cssLinks = clientDeps?.css
    ? clientDeps.css.map((cssFile: string) => `<link rel="stylesheet" href="${cssFile}">`).join('\n    ')
    : '';
  
  return { scriptSrc, cssLinks };
}
