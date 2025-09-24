# DecenVote Development Setup

## Prerequisites

- **Node.js 18+**
- **npm 9+**
- **Modern browser** (Chrome, Firefox, Safari, Edge)

## Quick Start

### 1. Create Project
```bash
# Create new Vite + React project
npm create vite@latest waku-polling-app -- --template react

# Navigate to project
cd waku-polling-app

# Install dependencies
npm install
```

### 2. Install Waku Dependencies
```bash
# Core packages only
npm install @waku/sdk @waku/react protobufjs @waku/message-encryption @waku/utils
```

## Complete package.json

```json
{
  "name": "waku-polling-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
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
    "@vitejs/plugin-react": "^4.1.1",
    "vite": "^5.0.0"
  }
}
```

## Vite Configuration

### vite.config.js
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
│   ├── App.jsx         # Main app
│   ├── App.css         # Styles
│   └── main.jsx        # Entry point
├── index.html
├── package.json
└── vite.config.js
```

### Create Structure
```bash
# Create folders
mkdir -p src/{components,hooks,services,utils}

# Create main files
touch src/services/WakuService.js
touch src/hooks/useWaku.js
touch src/components/PollCreation.jsx
touch src/components/PollList.jsx
touch src/components/VoteInterface.jsx
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
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

## Running the App

```bash
# Development
npm run dev

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

That's it! Simple and ready to code.