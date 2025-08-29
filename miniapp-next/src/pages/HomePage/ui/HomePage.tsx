"use client";

import { useMiniAppAuth } from "@/features/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import Image from "next/image";
import reactLogo from "@/assets/react.svg";

export function HomePage() {
  const { getCurrentUser, isAuthenticated } = useMiniAppAuth();
  const user = getCurrentUser();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center space-y-8">
        {/* User Welcome Card */}
        {isAuthenticated && user && (
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">
                Welcome, {user.email || "User"}!
              </CardTitle>
              <CardDescription>🎉 Great to see you back</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-2">
                {user.email && <Badge variant="outline">📧 {user.email}</Badge>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Welcome Card */}
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-6">
              <Image
                src={reactLogo}
                alt="App Logo"
                width={80}
                height={80}
                className="animate-spin"
                style={{ animationDuration: "8s" }}
              />
            </div>
            <CardTitle className="text-4xl font-bold">
              {user
                ? `Hello, ${user.name || user.email || "User"}!`
                : "Welcome to Your App"}
            </CardTitle>
            <CardDescription className="text-lg mt-2">
              🚀 Ready to start building something amazing
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              This is your application template powered by modern web technologies.
              Start building by editing components in the <code>src/</code> directory.
            </p>
          </CardContent>
        </Card>

        {/* Template Info Card */}
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-center">Template Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Badge variant="secondary">⚛️ React</Badge>
                <Badge variant="outline">📘 TypeScript</Badge>
                <Badge variant="secondary">⚡ Next.js</Badge>
                <Badge variant="outline">🎨 Tailwind CSS</Badge>
                <Badge variant="secondary">📦 shadcn/ui</Badge>
                <Badge variant="outline">🔐 Auth Ready</Badge>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                <p>Authentication, UI components, and development tools are all set up and ready to use.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Start */}
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-2xl">🛠️</div>
              <CardTitle className="text-lg">Ready to Build</CardTitle>
              <p className="text-sm text-muted-foreground">
                Your template includes authentication, database integration, and UI components.
                Check the <code>docs/</code> directory for detailed guides.
              </p>
              <div className="flex justify-center gap-2">
                <Badge>Template Ready</Badge>
                <Badge variant="outline">Documentation Available</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default HomePage;