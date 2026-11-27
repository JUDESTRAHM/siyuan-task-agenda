import esbuild from "esbuild";
await esbuild.build({ entryPoints: ["src/plugin.js"], bundle: true, format: "cjs", platform: "browser", target: "es2020", outfile: "index.js", external: ["siyuan"], minify: false, legalComments: "none" });
console.log("built index.js");
