# Development Setup

This guide provides step-by-step instructions for setting up the Waku Polling App development environment using Create React App with TypeScript and Craco.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Git

## Initial Setup

### 1. Clone or Create the Project

If starting from scratch:
```bash
# Create React App with TypeScript template
npx create-react-app waku-polling-app --template typescript
cd waku-polling-app
```

If cloning existing repository:
```bash
git clone [repository-url]
cd waku-polling-app
npm install
```

### 2. Install Waku Dependencies
```bash
# Core Waku packages
npm install @waku/sdk protobufjs @waku/message-encryption @waku/utils
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

## Complete package.json

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
    "@waku/sdk": "^0.0.34",
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

## TypeScript Configuration

The `tsconfig.json` file is configured for Create React App:

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

## Project Structure

```
waku-polling-app/
├── node_modules/
├── public/
│   ├── index.html
│   └── ...
├── src/
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   ├── services/          # Waku service layer
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   ├── App.tsx
│   ├── App.css
│   ├── index.tsx
│   └── index.css
├── craco.config.js        # Craco configuration
├── tsconfig.json          # TypeScript configuration
├── package.json
└── README.md
```

## Running the Application

```bash
# Development mode
npm start

# Build for production
npm run build

# Run tests
npm test
```

The application will start on `http://localhost:3000`

## Troubleshooting

### Common Issues

1. **Module resolution errors**: Make sure all polyfills are installed and craco.config.js is properly configured
2. **TypeScript errors**: Ensure @types packages are installed for all dependencies
3. **Build warnings about source maps**: These can be safely ignored (configured in craco.config.js)

### Waku-specific Configuration

- Waku requires specific Node.js polyfills to work in the browser environment
- The Craco configuration handles webpack modifications needed for Waku
- All Waku services should be initialized in the services directory

## Next Steps

After setup is complete:

1. Review the [Architecture Documentation](./ARCHITECTURE.md)
2. Understand [Waku Concepts](./WAKU_CONCEPTS.md)
3. Follow the [Development Phases](./DEVELOPMENT_PHASES.md)
4. Implement components following [Component Structure](./COMPONENT_STRUCTURE.md)