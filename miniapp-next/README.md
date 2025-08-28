# MiniApp Next.js

This is the Next.js version of the MiniApp template, featuring:

- **Next.js 15** with App Router
- **React Server Components (RSC)** - Native Next.js implementation
- **Feature Sliced Design (FSD)** - Complete architectural compliance
- **PostMessage Authentication** - iframe-based auth with parent app
- **PocketBase Integration** - Complete authentication and database layer
- **Server Actions** - AI services (fal.ai, OpenAI) and database operations
- **shadcn/ui + Tailwind CSS** - Modern UI component library

## Architecture

This project follows the [FSD (Feature Sliced Design) official recommendation](https://feature-sliced.design/docs/guides/tech/with-nextjs) for Next.js integration:

```
frontend-next/
├── app/              # Next.js App Router (routing layer)
│   ├── layout.tsx    # Root layout with auth integration
│   ├── page.tsx      # Root page (redirects to /home)
│   └── home/
│       └── page.tsx  # Home route
├── pages/            # Next.js compatibility (stub)
└── src/              # Complete FSD structure
    ├── app/          # FSD App layer (global providers)
    ├── pages/        # FSD Pages layer (page components)
    ├── features/     # FSD Features layer (auth, etc.)
    ├── entities/     # FSD Entities layer (domain models)
    └── shared/       # FSD Shared layer (UI, lib, server)
```

## Key Features

### Authentication System
- **PostMessage Integration**: Receives auth from parent app via iframe
- **PocketBase Auth**: Complete authentication with automatic token refresh
- **Persistent State**: LocalStorage + Cookie dual persistence
- **Error Handling**: Comprehensive auth error states and retry logic

### Server Actions
- **AI Services**: fal.ai (image/video/audio), OpenAI (chat/reasoning)
- **Database**: PocketBase CRUD operations
- **Type Safe**: Full TypeScript support with proper error handling

### Development Commands
```bash
# Development
npm run dev

# Production build
npm run build

# Production server
npm run start

# Type checking
npm run type-check

# Linting
npm run lint
```

## Migration from Vite Version

This Next.js version maintains 100% compatibility with the original Vite implementation:

- ✅ **Same FSD structure** - src/ directory preserved
- ✅ **Same authentication** - useMiniAppAuth hook unchanged
- ✅ **Same UI/UX** - shadcn/ui components preserved
- ✅ **Same server functions** - AI and database services maintained
- ✅ **Same postMessage** - Parent app integration unchanged

### Key Differences
- **Routing**: React Router → Next.js App Router
- **RSC**: Vite RSC plugin → Native Next.js RSC
- **Server Functions**: Custom `/actions` endpoint → Server Actions
- **Build**: Vite → Next.js build system

## Environment Variables

Copy from the original Vite version:
- `OPENAI_API_KEY` - OpenAI API access
- `FAL_KEY` - fal.ai API access  
- `POCKETBASE_URL` - PocketBase server URL (default: http://127.0.0.1:8090)

## Path Aliases

Maintained from original:
- `@/*` → `./src/*`
- `@/shared` → `./src/shared`
- `@/app` → `./src/app`
- `@/pages` → `./src/pages`
- `@/features` → `./src/features`
- `@/entities` → `./src/entities`