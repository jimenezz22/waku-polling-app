# DecenVote Development Setup

## Prerequisites

- **Node.js 18+**
- **npm 9+**
- **Modern browser** (Chrome, Firefox, Safari, Edge)

## Quick Start

### 1. Create Project
```bash
# Create new Vite + React + TypeScript project
npm create vite@latest waku-polling-app -- --template react-ts

# Navigate to project
cd waku-polling-app

# Install dependencies
npm install
```

### 2. Install Waku Dependencies
```bash
# Core Waku packages
npm install @waku/sdk @waku/react protobufjs @waku/message-encryption @waku/utils

# TypeScript support
npm install --save-dev typescript @types/node
```

**⚠️ Important:** Waku packages require React 18. If your project was created with a newer React version, downgrade to React 18:
```bash
npm install react@^18.2.0 react-dom@^18.2.0 @types/react@^18.2.66 @types/react-dom@^18.2.22
```

**Note:** If you encounter peer dependency conflicts during Waku installation, add `--legacy-peer-deps` flag to the install command.

## Complete package.json

```json
{
  "name": "waku-polling-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@waku/sdk": "^0.0.26",
    "@waku/react": "^0.0.26",
    "@waku/message-encryption": "^0.0.26",
    "@waku/utils": "^0.0.18",
    "protobufjs": "^7.2.5"
  },
  "devDependencies": {
    "@types/node": "^24.5.2",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^5.0.3",
    "typescript": "^5.9.2",
    "vite": "^7.1.7"
  }
}
```

## Vite Configuration

### vite.config.ts
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Required for Waku
  optimizeDeps: {
    exclude: ['@waku/sdk']
  },

  server: {
    port: 3000,
    open: true
  },

  define: {
    global: 'globalThis'
  }
})
```

## Project Structure

```bash
waku-polling-app/
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom hooks
│   ├── services/       # Waku services
│   ├── utils/          # Utilities
│   ├── App.tsx         # Main app
│   ├── App.css         # Styles
│   ├── main.tsx        # Entry point
│   └── vite-env.d.ts   # TypeScript declarations
├── index.html
├── package.json
├── tsconfig.json       # TypeScript config
├── tsconfig.node.json  # TypeScript config for Vite
└── vite.config.ts
```

### Create Structure
```bash
# Create folders
mkdir -p src/{components,hooks,services,utils}

# Create main files
touch src/services/WakuService.ts
touch src/hooks/useWaku.ts
touch src/components/PollCreation.tsx
touch src/components/PollList.tsx
touch src/components/VoteInterface.tsx
```

## Basic HTML Template

**index.html**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DecenVote</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## Running the App

```bash
# Development
npm run dev

# TypeScript type checking
npm run typecheck

# Production build
npm run build

# Preview production
npm run preview
```

## Simple Troubleshooting

**If Waku doesn't connect:**
- Check your internet connection
- Try refreshing the page
- Check browser console for errors

**If build fails:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

## TypeScript Configuration

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### tsconfig.node.json
```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "bundler",
    "module": "ESNext",
    "types": ["node"],
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

### src/vite-env.d.ts
```typescript
/// <reference types="vite/client" />

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}
```

That's it! Simple and ready to code with TypeScript support.