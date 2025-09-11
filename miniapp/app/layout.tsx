import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import ClientLogging from "./_client-logging";

export const metadata: Metadata = {
  title: "MiniApp Next.js",
  description: "Mini-application development template with Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning={true}>
      <body>
        <ClientLogging />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
