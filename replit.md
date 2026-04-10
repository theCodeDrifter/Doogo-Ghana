# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Doogo (Mobile App) — `artifacts/doogo/`
- **Type**: Expo (React Native)
- **Purpose**: Native mobile app wrapper for https://doogo.shop
- **Bundle ID**: com.palipali.doogo
- **Key features**:
  - WebView with react-native-webview embedding doogo.shop
  - Custom splash/loading screen with animated Doogo logo on #d5f7f0 background
  - Offline detection with retry screen (@react-native-community/netinfo)
  - Pull-to-refresh via WebView's built-in pullToRefreshEnabled
  - Android hardware back button navigates WebView history
  - External link handling (opens in device browser)
  - File upload support (expo-image-picker)
  - Push notifications (expo-notifications, structure ready for backend)
  - Custom CSS injection: shows mobile header (.elementor-element-58ced7a), hides desktop header (.elementor-element-8d79317), breadcrumb (.elementor-element-5abdb2), section (.elementor-element-a6cfc58), footer (.elementor-element-3271f048)
  - Skeleton shimmer loading for non-precached pages
  - Persistent cookies / DOM storage for login sessions
  - Navigation restricted to doogo.shop domain
  - iOS swipe-back navigation enabled
- **Folder structure**:
  - `app/` — Expo Router screens
  - `components/` — SplashLoading, OfflineScreen, SkeletonShimmer, ErrorBoundary
  - `screens/` — WebViewScreen (main WebView)
  - `hooks/` — useNetwork, useWebViewCache, useColors
  - `services/` — notifications.ts
  - `utils/` — urlUtils.ts, injectedJS.ts
  - `constants/` — colors.ts (Doogo brand palette)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
