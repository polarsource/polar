const path = require("path")

module.exports = {
  entry: {
    content: "./src/index.tsx",
    auth: "./src/auth.tsx",
    popup: "./src/popup.tsx",
  },
  mode: "production",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
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
            loader: "style-loader",
          },
          {
            loader: "css-loader",
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: "url-loader",
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "[name].js",
    // path: path.resolve(__dirname, "..", "extension"),
  },
}
