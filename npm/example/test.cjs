/**
 * Browser check of the packed package.
 *   1. dist/ (Vite build)  - ESM import, SDK emitted by the bundler and injected
 *   2. plain.html          - classic <script> from node_modules, no bundler
 *   3. Node                - createSessionToken() against the real endpoint with a
 *                            wrong key: must be refused with the server's reason.
 * PUPPETEER=<path to puppeteer> if it is not installed here.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require(process.env.PUPPETEER || "puppeteer");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css" };
function serve(dir) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const p = path.join(dir, decodeURIComponent(req.url.split("?")[0]));
            fs.readFile(p, (err, data) => {
                if (err) { res.writeHead(404); res.end("not found"); return; }
                res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
                res.end(data);
            });
        }).listen(0, "127.0.0.1", () => resolve(server));
    });
}

async function check(browser, url) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("requestfailed", (r) => errors.push("request failed: " + r.url()));
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction("window.__e3dsTest", { timeout: 30000 });
    const result = await page.evaluate(() => window.__e3dsTest);
    await page.close();
    return { result, errors };
}

(async () => {
    let failed = 0;
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    for (const [label, dir, file] of [["vite build (ESM)", path.join(__dirname, "dist"), "/index.html"],
                                      ["plain <script>", __dirname, "/plain.html"]]) {
        const server = await serve(dir);
        const url = "http://127.0.0.1:" + server.address().port + file;
        const { result, errors } = await check(browser, url);
        server.close();
        console.log("\n== " + label + " " + url);
        console.log(JSON.stringify(result, null, 1));
        if (errors.length) console.log("page errors:", errors);
        const need = ["main", "terminate", "sendMessageToStreamingBuild", "setResolution", "setVideoDetailLevel"];
        const missing = need.filter((m) => !(result.methods || []).includes(m));
        if (!result.ok || missing.length) { failed++; console.log("FAIL missing:", missing); } else console.log("PASS");
    }
    await browser.close();

    const { createSessionToken } = await import("@eagle3dstreaming/web-sdk");
    try {
        await createSessionToken({
            apiKey: "not-a-real-key",
            application: { domain: "connector.eagle3dstreaming.com", userName: "demo", appName: "EpicPixelStreamingSample", configurationName: "default" }
        });
        failed++;
        console.log("\n== node createSessionToken: FAIL - a wrong key was accepted");
    } catch (e) {
        console.log("\n== node createSessionToken with a wrong key: refused as expected -> status " + e.status + ": " + e.message.slice(0, 160));
        if (!e.status) failed++;
    }
    console.log(failed ? "\nFAILED: " + failed : "\nALL PASS");
    process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("[test] crashed:", e); process.exit(1); });
