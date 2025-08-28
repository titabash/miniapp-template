import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

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
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}