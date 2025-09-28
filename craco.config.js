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
        "process": require.resolve("process/browser"),
        "process/browser": require.resolve("process/browser"),
        "vm": false,
        "fs": false,
        "net": false,
        "tls": false,
      };

      // Handle .js extensions for ESM modules
      webpackConfig.resolve.extensionAlias = {
        ...webpackConfig.resolve.extensionAlias,
        '.js': ['.ts', '.tsx', '.js', '.jsx']
      };

      // Add alias for process/browser to resolve correctly
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        'process/browser': require.resolve('process/browser.js'),
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