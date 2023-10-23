const EnvironmentPlugin = require('webpack').EnvironmentPlugin
const path = require('path');

module.exports = {
  entry: {
    content: './src/index.tsx',
    auth: './src/auth.ts',
    'service-worker': './src/service-worker/index.ts',
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: { noEmit: false },
            },
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: 'url-loader',
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@polarkit/lib/utils': path.resolve(__dirname, '../../packages/polarkit/src/lib/utils'),
    }
  },
  plugins: [
    new EnvironmentPlugin({
      API_URL: '',
      WEB_URL: '',
    }),
  ],
  output: {
    filename: '[name].js',
  },
}
