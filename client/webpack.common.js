const path = require("path");
var HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    entry: {
        vendor: "./src/vendor.js",
        main: {
            dependOn: 'vendor',
            import: "./src/index.js"
        }
    },

};