const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.module.rules.push({
        test: /\.js$/,
        include: path.resolve(__dirname, 'node_modules/pdfjs-dist'),
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [
              '@babel/plugin-proposal-private-methods',
              '@babel/plugin-proposal-class-properties',
              '@babel/plugin-proposal-private-property-in-object' // ここに追加
            ]
          }
        }
      });

      return webpackConfig;
    },
  },
};
