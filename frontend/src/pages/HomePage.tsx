import { useMiniAppAuth } from "@/features/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
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

        {/* Hero Card */}
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-6">
              <img
                src={reactLogo}
                alt="React"
                className="h-20 w-20 animate-spin"
                style={{ animationDuration: "8s" }}
              />
            </div>
            <CardTitle className="text-4xl font-bold">
              {user
                ? `Hello, ${user.name || user.email || "User"}!`
                : "Hello World"}
            </CardTitle>
            <CardDescription className="text-lg mt-2">
              🚀 A modern React application built with the latest technologies
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Tech Stack */}
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-center">Tech Stack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-3 flex-wrap">
              <Badge variant="secondary">⚛️ React</Badge>
              <Badge variant="outline">📘 TypeScript</Badge>
              <Badge variant="secondary">⚡ Vite</Badge>
              <Badge variant="outline">🎨 Tailwind CSS</Badge>
              <Badge variant="secondary">📦 shadcn/ui</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="w-full max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-6">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="text-center hover:shadow-lg transition-shadow duration-300">
              <CardContent className="pt-6">
                <div className="text-4xl mb-4">🔐</div>
                <CardTitle className="text-lg mb-2">Authentication</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Secure user authentication system with modern protocols
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow duration-300">
              <CardContent className="pt-6">
                <div className="text-4xl mb-4">🎨</div>
                <CardTitle className="text-lg mb-2">Modern UI</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Beautiful and intuitive interface with shadcn/ui components
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow duration-300">
              <CardContent className="pt-6">
                <div className="text-4xl mb-4">📱</div>
                <CardTitle className="text-lg mb-2">Responsive</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Works perfectly on all devices with responsive design
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow duration-300">
              <CardContent className="pt-6">
                <div className="text-4xl mb-4">⚡</div>
                <CardTitle className="text-lg mb-2">Fast Loading</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Optimized for performance with Vite and modern tooling
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Additional Info */}
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-2xl">✨</div>
              <p className="text-muted-foreground">
                Built with modern web technologies and best practices for
                scalable applications.
              </p>
              <div className="flex justify-center gap-2">
                <Badge>Production Ready</Badge>
                <Badge variant="outline">TypeSafe</Badge>
                <Badge>Accessible</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}