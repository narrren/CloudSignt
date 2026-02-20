const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  mode: 'production',
  entry: {
    background: './src/background.js',
    popup: './src/popup.js',
    options: './src/options.js',
    dashboard: './src/dashboard.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: true, // Automatically removes all console.log
        },
      },
    })],
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: '.' },
        { from: 'src/popup.html', to: '.', noErrorOnMissing: true },
        { from: 'src/options.html', to: '.', noErrorOnMissing: true },
        { from: 'src/dashboard.html', to: '.', noErrorOnMissing: true },
        { from: 'src/assets', to: 'assets', noErrorOnMissing: true },
      ],
    }),
  ],
  devtool: false,
};
