const path = require('path');
const webpack = require('webpack');

module.exports = [
  {
    entry: './src/tab.js',
    mode: 'production',
    output: {
      path: path.resolve(__dirname),
      filename: 'bg/tab.js'
    },
    // devtool: 'inline-nosources-cheap-source-map',
    module: {
      rules: [
        {test: /\.(js|jsx)$/, use: 'babel-loader', exclude: /node_modules/}
      ]
    }
  },
  {
    entry: './src/browse.js',
    mode: 'development',
    output: {
      path: path.resolve(__dirname),
      filename: 'public/js/browse.main.js'
    },
    devtool: 'inline-source-map',
    module: {
      rules: [
        {test: /\.(js|jsx)$/, use: 'babel-loader', exclude: /node_modules/}
      ]
    }
    // ,"resolve": {
    //   "alias": {
    //     "react": "preact-compat",
    //     "react-dom": "preact-compat"
    //   }
    // }
  }
];