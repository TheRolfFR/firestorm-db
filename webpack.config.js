const path = require('path');

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: 'production',
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'firestorm-db.js',
        library: 'firestorm-db',
        libraryTarget: 'umd',
        globalObject: 'this',
        umdNamedDefine: true
    }
};
