# Development Setup

This guide provides step-by-step instructions for setting up the DecenVote development environment using **Create React App with TypeScript** and **Waku SDK 0.0.35** with **ReliableChannel**.

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** or yarn
- **Git**
- **Modern browser** with WebRTC support (Chrome, Firefox, Safari)

## Initial Setup

### 1. Clone or Create the Project

If starting from scratch:
```bash
# Create React App with TypeScript template
npx create-react-app waku-polling-app --template typescript
cd waku-polling-app
```

### 2. Install Waku Dependencies (SDK 0.0.35)

```bash
# Core Waku SDK 0.0.35 with ReliableChannel support
npm install @waku/sdk@0.0.35

# Additional required packages
npm install protobufjs @waku/message-encryption @waku/utils
```

### 3. Install Craco and Node Polyfills

Since Waku libraries require Node.js polyfills for browser compatibility, we need to configure webpack using Craco:

```bash
# Install Craco
npm install --save-dev @craco/craco

# Install required polyfills
npm install --save-dev assert buffer crypto-browserify https-browserify os-browserify process stream-browserify stream-http url util webpack-node-externals
```

### 4. Configure Craco

Create `craco.config.js` in the project root:

```javascript
const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add Node.js polyfills for browser
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "buffer": require.resolve("buffer"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "url": require.resolve("url"),
        "util": require.resolve("util"),
        "vm": false,
        "fs": false,
        "net": false,
        "tls": false,
      };

      // Add plugins
      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
        new webpack.DefinePlugin({
          global: 'globalThis',
        })
      ];

      // Ignore certain modules that cause issues
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /Critical dependency: the request of a dependency is an expression/,
      ];

      return webpackConfig;
    },
  },
};
```

### 5. Update package.json Scripts

Replace the default scripts in `package.json` with Craco commands:

```json
"scripts": {
  "start": "craco start",
  "build": "craco build",
  "test": "craco test",
  "eject": "react-scripts eject"
}
```

## Complete package.json (Updated for Waku SDK 0.0.35)

```json
{
  "name": "waku-polling-app-cra",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^13.5.0",
    "@types/jest": "^27.5.2",
    "@types/node": "^16.18.126",
    "@types/react": "^19.1.13",
    "@types/react-dom": "^19.1.9",
    "@waku/message-encryption": "^0.0.37",
    "@waku/sdk": "^0.0.35",
    "@waku/utils": "^0.0.27",
    "protobufjs": "^7.5.4",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-scripts": "5.0.1",
    "typescript": "^4.9.5",
    "web-vitals": "^2.1.4"
  },
  "scripts": {
    "start": "craco start",
    "build": "craco build",
    "test": "craco test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "devDependencies": {
    "@craco/craco": "^7.1.0",
    "assert": "^2.1.0",
    "buffer": "^6.0.3",
    "crypto-browserify": "^3.12.1",
    "https-browserify": "^1.0.0",
    "os-browserify": "^0.3.0",
    "process": "^0.11.10",
    "stream-browserify": "^3.0.0",
    "stream-http": "^3.2.0",
    "url": "^0.11.4",
    "util": "^0.12.5",
    "webpack-node-externals": "^3.0.0"
  }
}
```

## Project Structure (Modular Architecture)

```
waku-polling-app/
├── node_modules/
├── public/
│   ├── index.html
│   └── ...
├── src/
│   ├── components/         # React UI components
│   │   ├── PollCreation.tsx
│   │   ├── PollList.tsx
│   │   ├── VoteInterface.tsx
│   │   └── ConnectionStatus.tsx
│   ├── hooks/             # Custom React hooks
│   │   ├── usePolls.ts
│   │   ├── useVotes.ts
│   │   └── useIdentity.ts
│   ├── services/          # Modular Waku service layer
│   │   ├── config/
│   │   │   └── WakuConfig.ts        # Centralized configuration
│   │   ├── validators/
│   │   │   └── DataValidator.ts     # Data validation
│   │   ├── channels/
│   │   │   ├── ChannelManager.ts    # Channel management
│   │   │   └── DataProcessor.ts     # Data processing
│   │   ├── utils/
│   │   │   └── StoreErrorPatcher.ts # Error handling
│   │   ├── protocols/
│   │   │   ├── ReliableChannelService.ts # ReliableChannel orchestrator
│   │   │   └── StoreService.ts           # Historical data
│   │   ├── WakuService.ts          # Core Waku integration
│   │   ├── IdentityService.ts      # Identity management
│   │   ├── ProtobufSchemas.ts      # Data schemas
│   │   └── DataService.ts          # Unified API
│   ├── utils/             # Utility functions
│   ├── styles/            # CSS styling
│   ├── App.tsx
│   ├── App.css
│   ├── index.tsx
│   └── index.css
├── docs/                  # Documentation (organized)
│   ├── core/             # Core concepts
│   ├── guides/           # Development guides
│   ├── technical/        # Technical documentation
│   └── workshops/        # Workshop materials
├── craco.config.js        # Craco configuration
├── tsconfig.json          # TypeScript configuration
├── package.json
└── README.md
```

## TypeScript Configuration

The `tsconfig.json` file is configured for Create React App with strict typing:

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": [
    "src"
  ]
}
```

## Running the Application

```bash
# Development mode (with hot reload)
npm start

# Build for production
npm run build

# Run tests
npm test

# Serve production build locally
npm install -g serve
serve -s build
```

The application will start on `http://localhost:3000`

## Development Workflow

### 1. Initial Development
```bash
# Start development server
npm start

# In another terminal, run type checking
npx tsc --noEmit --watch
```

### 2. Building and Testing
```bash
# Build the project
npm run build

# Test the build locally
serve -s build

# Run tests
npm test
```

### 3. Debugging Waku Integration
```bash
# Enable Waku debug logs in browser console
localStorage.debug = '@waku/*'

# Or for specific modules
localStorage.debug = '@waku/core:*,@waku/sdk:*'
```

## Troubleshooting

### Common Issues

1. **Module resolution errors**:
   - Ensure all polyfills are installed
   - Verify craco.config.js is properly configured
   - Clear node_modules and reinstall if needed

2. **Waku SDK 0.0.35 specific issues**:
   - Use exact version `@waku/sdk@0.0.35`
   - Ensure ReliableChannel imports are correct
   - Check browser console for Waku debug logs

3. **TypeScript errors**:
   - Ensure @types packages are installed
   - Use DataValidator for all data validation
   - Follow interface definitions in ProtobufSchemas.ts

4. **Build warnings about source maps**:
   - These can be safely ignored (configured in craco.config.js)
   - Warnings about critical dependencies are normal for Waku

### ReliableChannel Specific Configuration

- **ReliableChannel** requires proper channel setup via ChannelManager
- **Store protocol errors** are handled gracefully by StoreErrorPatcher
- **Data validation** should use centralized DataValidator
- **Configuration** should be managed through WakuConfig

### Browser Compatibility

- **Chrome/Edge**: Full support for all features
- **Firefox**: Full support with latest versions
- **Safari**: WebRTC support required for optimal performance
- **Mobile browsers**: Basic functionality works, real-time features may be limited

## Environment Variables (Optional)

Create `.env.local` for development configuration:

```bash
# Waku debug logging
REACT_APP_WAKU_DEBUG=true

# Custom bootstrap peers (if needed)
REACT_APP_CUSTOM_BOOTSTRAP_PEER=your-peer-address
```

## Next Steps

After setup is complete:

1. **Review Core Concepts**: [`docs/core/CONTEXT.md`](../core/CONTEXT.md)
2. **Understand Waku**: [`docs/core/WAKU_CONCEPTS.md`](../core/WAKU_CONCEPTS.md)
3. **Follow Development Phases**: [`docs/workshops/DEVELOPMENT_PHASES.md`](../workshops/DEVELOPMENT_PHASES.md)
4. **Study Architecture**: [`docs/technical/ARCHITECTURE.md`](../technical/ARCHITECTURE.md)
5. **Learn Component Structure**: [`docs/guides/COMPONENT_STRUCTURE.md`](./COMPONENT_STRUCTURE.md)

## Verification Checklist

✅ **Environment Setup**:
- [ ] Node.js v18+ installed
- [ ] npm/yarn working
- [ ] Git configured

✅ **Project Setup**:
- [ ] Create React App initialized
- [ ] Waku SDK 0.0.35 installed
- [ ] Craco configured correctly
- [ ] TypeScript compiling without errors

✅ **Development Ready**:
- [ ] `npm start` runs without errors
- [ ] Browser console shows no critical errors
- [ ] Hot reload working
- [ ] Modular service structure in place

This setup provides a solid foundation for building the DecenVote application with Waku SDK 0.0.35 and ReliableChannel integration.