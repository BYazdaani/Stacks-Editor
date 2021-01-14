const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const HtmlWebpackPlugin = require("html-webpack-plugin");

// set to `true` if you'd like an idea of how the bundle looks minified / gzipped
// set to `false` by default, don't check this change in!
const emulateProdServer = false;

module.exports = (env, argv) =>
    merge(common(env, argv), {
        entry: {
            app: "./site/index.ts",
        },
        mode: emulateProdServer ? "production" : "development",
        devtool: emulateProdServer ? false : "inline-source-map",
        devServer: {
            open: true,
            host:
                // set the host to 0.0.0.0 by default so we can preview the demo on other devices in the same network
                // NOTE: 0.0.0.0 doesn't work on Windows machines, so settle for localhost instead
                emulateProdServer && process.platform !== "win32"
                    ? "0.0.0.0 "
                    : "localhost",
            watchOptions: {
                ignored: ["test/**/*", "node_modules/**"],
            },
            contentBase: "./dist",
            compress: emulateProdServer,
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: "./site/index.html",
            }),
            new HtmlWebpackPlugin({
                template: "./site/empty.html",
                filename: "empty.html",
            }),
            new HtmlWebpackPlugin({
                template: "./site/noimage.html",
                filename: "noimage.html",
            }),
            new HtmlWebpackPlugin({
                template: "./site/tables.html",
                filename: "tables.html",
            }),
        ],
        optimization: {
            splitChunks: {
                cacheGroups: {
                    // split highlightjs and languages into its own bundle for testing async language loading
                    hljs: {
                        test: /highlight.js/,
                        chunks: "all",
                    },
                },
            },
        },
    });