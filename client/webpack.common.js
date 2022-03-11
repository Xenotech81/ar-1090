const path = require("path");


module.exports = {
    entry: {
        vendor: "./src/vendor.js",
        main: {
            dependOn: 'vendor',
            import: "./src/index.js"
        }
    },

};