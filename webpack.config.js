const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

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
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: '.' },
        { from: 'src/popup.html', to: '.' },
        { from: 'src/styles.css', to: '.', noErrorOnMissing: true },
        { from: 'src/options.html', to: '.' },
        { from: 'src/dashboard.html', to: '.', noErrorOnMissing: true },
        { from: 'src/icon.png', to: '.', noErrorOnMissing: true },

      ],
    }),
  ],
  devtool: 'cheap-module-source-map',
};
