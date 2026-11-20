/**
 * Builds npm/dist from the repository. Runs by itself before `npm pack` and
 * `npm publish` (the "prepack" script), so a publish always ships the SDK build
 * that is in the repository at that moment.
 *
 *   ../scripts/dist/e3dsCore.min_ns.js  ->  dist/e3dsCore.min_ns.js  (byte for byte)
 *   src/index.mjs                       ->  dist/index.mjs  (ES module)
 *                                       ->  dist/index.cjs  (CommonJS, for require())
 *   src/index.d.ts                      ->  dist/index.d.ts
 *
 * [E3DS-NPM-SECRET-SCAN] Fails the build when anything in the package looks
 * like a server-side secret, so a key pasted into the SDK or the demo can never
 * reach the npm registry unnoticed.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const sdkSource = join(root, "..", "scripts", "dist", "e3dsCore.min_ns.js");
const dist = join(root, "dist");

if (!existsSync(sdkSource)) {
    console.error("[E3DS-NPM-BUILD] the SDK build is missing: " + sdkSource);
    process.exit(1);
}
mkdirSync(dist, { recursive: true });

const stamp = (s) => s.split("__PKG_NAME__").join(pkg.name).split("__PKG_VERSION__").join(pkg.version);

// ES module
const esm = stamp(readFileSync(join(root, "src", "index.mjs"), "utf8"));
writeFileSync(join(dist, "index.mjs"), esm);

// CommonJS: same code; import.meta does not exist there, so the bundled-file
// lookup is replaced (require() users get the CDN copy or their own `src`).
const start = esm.indexOf("/*__BUNDLED_URL_START__*/");
const end = esm.indexOf("/*__BUNDLED_URL_END__*/");
if (start < 0 || end < 0) {
    console.error("[E3DS-NPM-BUILD] markers __BUNDLED_URL_START__/END__ not found in src/index.mjs");
    process.exit(1);
}
let cjs = esm.slice(0, start)
    + "function bundledSdkUrl() {\n    /* CommonJS has no import.meta: no bundled-file address. */\n    return null;\n}\n"
    + esm.slice(end + "/*__BUNDLED_URL_END__*/".length);
// CommonJS has no dynamic-import chunking worth relying on: no inline copy there.
const iStart = cjs.indexOf("/*__INLINE_START__*/");
const iEnd = cjs.indexOf("/*__INLINE_END__*/");
if (iStart < 0 || iEnd < 0) {
    console.error("[E3DS-NPM-BUILD] markers __INLINE_START__/END__ not found in src/index.mjs");
    process.exit(1);
}
cjs = cjs.slice(0, iStart)
    + "async function inlineSdkSource() {\n    throw new Error(\"not available with require() - pass options.src or allow the CDN\");\n}\n"
    + cjs.slice(iEnd + "/*__INLINE_END__*/".length);
const exported = [];
cjs = cjs.replace(/^export (const|function|async function) ([A-Za-z0-9_]+)/gm, (m, kind, name) => {
    exported.push(name);
    return kind + " " + name;
});
cjs = cjs.replace(/^export default [^\n]*\n?/m, "");
cjs = '"use strict";\n' + cjs + "\nmodule.exports = { " + exported.join(", ") + " };\nmodule.exports.default = module.exports;\n";
writeFileSync(join(dist, "index.cjs"), cjs);

copyFileSync(join(root, "src", "index.d.ts"), join(dist, "index.d.ts"));
copyFileSync(sdkSource, join(dist, "e3dsCore.min_ns.js"));
// The same SDK as a string module, for loadE3dsSdk()'s inline fallback.
writeFileSync(join(dist, "sdk-source.mjs"),
    "/* The E3DS Web SDK build as text, generated from e3dsCore.min_ns.js. Do not edit. */\nexport default "
    + JSON.stringify(readFileSync(sdkSource, "utf8")) + ";\n");

// Secret scan over everything that will be published.
const SECRET_PATTERNS = [
    [/sk_live_[0-9A-Za-z]{10,}/, "Stripe live secret key"],
    [/sk_test_[0-9A-Za-z]{10,}/, "Stripe test secret key"],
    [/rk_live_[0-9A-Za-z]{10,}/, "Stripe restricted key"],
    [/AKIA[0-9A-Z]{16}/, "AWS access key id"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
    [/\b[0-9]{8,10}:AA[0-9A-Za-z_-]{30,}/, "Telegram bot token"],
    [/xox[abposr]-[0-9A-Za-z-]{10,}/, "Slack token"],
    [/"type"\s*:\s*"service_account"/, "Google service account"],
    [/STREAMING_API_KEY\s*=\s*"(?!Your Streaming API Key")[^"]{8,}"/, "a real Streaming API key"],
    [/Authorization["']?\s*:\s*["']Auth [A-Za-z0-9._-]{16,}/, "a hard-coded Streaming API key"]
];
// Browser-side keys that are part of the SDK build and already served to every
// viewer. Reported, not fatal; see NPM-PACKAGES-WEBSDK-IFRAME.md.
const KNOWN_PUBLIC = [[/ipgeolocation\.abstractapi\.com\/v1\/\?api_key=/, "AbstractAPI geolocation key (browser-side, already public in the SDK build)"]];

let bad = 0;
for (const f of ["index.mjs", "index.cjs", "index.d.ts", "e3dsCore.min_ns.js", "sdk-source.mjs"]) {
    const text = readFileSync(join(dist, f), "utf8");
    for (const [re, what] of SECRET_PATTERNS) {
        if (re.test(text)) {
            console.error("[E3DS-NPM-SECRET-SCAN] dist/" + f + " contains what looks like " + what + " - not publishing.");
            bad++;
        }
    }
    for (const [re, what] of KNOWN_PUBLIC) {
        if (re.test(text)) console.warn("[E3DS-NPM-SECRET-SCAN] note: dist/" + f + " contains the " + what + ".");
    }
}
if (bad) process.exit(1);

console.log("[E3DS-NPM-BUILD] " + pkg.name + "@" + pkg.version + " built: exports " + exported.join(", "));
