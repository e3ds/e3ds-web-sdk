/**
 * __PKG_NAME__ __PKG_VERSION__
 *
 * A thin, dependency-free wrapper around the Eagle 3D Streaming Web SDK build
 * (dist/e3dsCore.min_ns.js). The SDK itself is a classic browser script that
 * defines the global `e3ds_controller`; this module only
 *
 *   - loads that script into the page (once, however many times it is asked),
 *   - exchanges a Streaming API key for a session token (browser OR server),
 *   - hands the token to the player.
 *
 * Why a <script> tag and not a plain import of the SDK file: the SDK build is a
 * classic script and must run in sloppy mode at global scope. Bundlers wrap and
 * strict-mode everything they import, which breaks it. Injecting it as a
 * <script> keeps it running exactly as it does on the demo page.
 *
 * [E3DS-NPM-LOADER] grep tag for the loader.
 */

export const PACKAGE_NAME = "__PKG_NAME__";
export const VERSION = "__PKG_VERSION__";

/** The SDK build inside this package. */
export const SDK_FILE = "dist/e3dsCore.min_ns.js";

/** The endpoint that issues session tokens. */
export const TOKEN_ENDPOINT = "https://token.eagle3dstreaming.com/api/v2/token/create";

/** The same SDK build, served by a public CDN, pinned to THIS package version. */
export const CDN_URL = "https://cdn.jsdelivr.net/npm/" + PACKAGE_NAME + "@" + VERSION + "/" + SDK_FILE;

/** The element the player renders into. The SDK looks it up by this id. */
export const PLAYER_ELEMENT_ID = "playerUI";

function e3dsNpmError(message, err) {
    if (typeof window !== "undefined" && typeof window.e3ds_error === "function") {
        window.e3ds_error(message, err);
    } else {
        console.error(message, err === undefined ? "" : err);
    }
}

function e3dsNpmWarn(message) {
    if (typeof window !== "undefined" && typeof window.e3ds_warn === "function") {
        window.e3ds_warn(message);
    } else {
        console.warn(message);
    }
}

/*__BUNDLED_URL_START__*/
/**
 * Where the bundler put the SDK file that ships in this package.
 *
 * `new URL("./file", import.meta.url)` is the standard asset pattern: Vite,
 * webpack 5, Rollup and Parcel copy the file into the build and rewrite this
 * to its final address. If a tool does not understand it, the address simply
 * does not exist, the load fails, and loadE3dsSdk() moves on to the CDN.
 */
function bundledSdkUrl() {
    try {
        return new URL("./e3dsCore.min_ns.js", import.meta.url).href;
    } catch (e) {
        e3dsNpmWarn("[E3DS-NPM-LOADER] could not work out the address of the bundled SDK file: " + (e && e.message));
        return null;
    }
}
/*__BUNDLED_URL_END__*/

/*__INLINE_START__*/
/**
 * The SDK's source text, from a module of its own. A dynamic import, so a
 * bundler puts it in a separate chunk that is only downloaded when the
 * address-based ways above have failed (for example under a dev server that
 * pre-bundles packages and loses the asset file). Needs a page that allows
 * inline scripts; under a strict Content-Security-Policy use options.src.
 */
async function inlineSdkSource() {
    const mod = await import("./sdk-source.mjs");
    return mod.default;
}
/*__INLINE_END__*/

/** The SDK's controller, once the SDK has loaded; otherwise undefined. */
export function getController() {
    if (typeof window === "undefined") return undefined;
    const c = window.e3ds_controller;
    return c && typeof c.main === "function" ? c : undefined;
}

function ensurePlayerElement() {
    if (document.getElementById(PLAYER_ELEMENT_ID)) return;
    const div = document.createElement("div");
    div.id = PLAYER_ELEMENT_ID;
    document.body.appendChild(div);
}

function injectInline(source) {
    const s = document.createElement("script");
    s.setAttribute("data-e3ds-sdk", VERSION + " inline");
    s.textContent = source;
    document.head.appendChild(s);
    const controller = getController();
    if (!controller) {
        s.remove();
        throw new Error("the inline copy of the SDK ran but did not define e3ds_controller (blocked by a Content-Security-Policy?)");
    }
    return controller;
}

function injectScript(src, timeoutMs) {
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = false;
        s.setAttribute("data-e3ds-sdk", VERSION);
        const timer = setTimeout(() => {
            s.onload = s.onerror = null;
            reject(new Error("timed out after " + timeoutMs + " ms loading " + src));
        }, timeoutMs);
        s.onload = () => {
            clearTimeout(timer);
            /* A 404 answered with an HTML page (dev servers do that) still
             * "loads". Only a defined controller proves the SDK really ran. */
            if (getController()) resolve(getController());
            else {
                s.remove();
                reject(new Error("loaded " + src + " but it did not define e3ds_controller - not the SDK file"));
            }
        };
        s.onerror = () => {
            clearTimeout(timer);
            s.remove();
            reject(new Error("could not load " + src));
        };
        document.head.appendChild(s);
    });
}

/**
 * The SDK starts its player from document.body.onload. When it is loaded after
 * the page has already finished loading (a single-page app, a lazy import) that
 * event has gone, so start the player here instead. It then waits, polling, for
 * main() to be given a token - exactly as it does on a static page.
 */
function startPlayerIfPageAlreadyLoaded() {
    try {
        if (document.readyState === "complete"
            && !window.pixelStreaming
            && !window.__e3dsNpmPlayerKicked
            && typeof window.callBack_document_body_onload === "function") {
            window.__e3dsNpmPlayerKicked = true;
            window.callBack_document_body_onload();
        }
    } catch (e) {
        e3dsNpmError("[E3DS-NPM-LOADER] starting the player after page load failed:", e);
    }
}

let loading = null;

/**
 * Load the Web SDK into the page. Safe to call any number of times; the SDK is
 * loaded once and every call resolves to the same controller.
 *
 * @param {object} [options]
 * @param {string} [options.src] Load the SDK from this address instead
 *        (for example your own copy of dist/e3dsCore.min_ns.js).
 * @param {number} [options.timeoutMs=30000] Give up on one address after this long.
 * @param {boolean} [options.cdnFallback=true] Try CDN_URL if the bundled file cannot be loaded.
 * @returns {Promise<object>} window.e3ds_controller
 */
export function loadE3dsSdk(options = {}) {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return Promise.reject(new Error("[E3DS] loadE3dsSdk() runs in a browser. On a server, use createSessionToken()."));
    }
    const ready = getController();
    if (ready) return Promise.resolve(ready);
    if (loading) return loading;

    ensurePlayerElement();
    const timeoutMs = options.timeoutMs || 30000;
    /* In order: your address; the file the bundler emitted; the copy inside
     * this package as inline text; the CDN copy of this exact version. */
    const steps = options.src
        ? [{ what: options.src, run: () => injectScript(options.src, timeoutMs) }]
        : [
            { what: "bundled file", run: () => { const u = bundledSdkUrl(); if (!u) throw new Error("no bundled file address"); return injectScript(u, timeoutMs); } },
            { what: "inline copy", run: async () => injectInline(await inlineSdkSource()) },
            options.cdnFallback === false ? null : { what: CDN_URL, run: () => injectScript(CDN_URL, timeoutMs) }
        ].filter(Boolean);

    loading = (async () => {
        const failures = [];
        for (const step of steps) {
            try {
                const controller = await step.run();
                startPlayerIfPageAlreadyLoaded();
                if (failures.length) console.info("[E3DS-NPM-LOADER] SDK loaded from the " + step.what + " (earlier: " + failures.join("; ") + ")");
                return controller;
            } catch (e) {
                /* Printed below: as console.info when a later step works, as an error when none does. */
                failures.push(step.what + ": " + (e && e.message));
            }
        }
        loading = null;
        const err = new Error("[E3DS] the Web SDK could not be loaded: " + failures.join("; "));
        e3dsNpmError("[E3DS-NPM-LOADER] " + err.message);
        throw err;
    })();
    return loading;
}

let warnedKeyInBrowser = false;

/**
 * Exchange a Streaming API key for a short-lived session token.
 *
 * Works on a server (Node 18+, which has fetch) and in a browser. In a browser
 * the key is readable by every visitor: fine for a local test, never for a
 * public page - there, run this on your server and send only the token down.
 *
 * @returns {Promise<object>} The token data to pass to startStream().
 */
export async function createSessionToken(options) {
    const o = options || {};
    const app = o.application || {};
    const missing = [];
    if (!o.apiKey) missing.push("apiKey");
    for (const f of ["domain", "userName", "appName", "configurationName"]) {
        if (!app[f]) missing.push("application." + f);
    }
    if (missing.length) {
        throw new Error("[E3DS] createSessionToken(): missing " + missing.join(", "));
    }

    if (typeof window !== "undefined" && !warnedKeyInBrowser) {
        warnedKeyInBrowser = true;
        e3dsNpmWarn("[E3DS] createSessionToken() is running in a browser, so your Streaming API key is visible to "
            + "anyone who opens this page. Fine for local testing. For a public page create the token on your server. "
            + "https://learn.eagle3dstreaming.com/wiki/sdk-secure-the-key");
    }

    const doFetch = o.fetch || (typeof fetch === "function" ? fetch : null);
    if (!doFetch) throw new Error("[E3DS] createSessionToken(): no fetch() available - use Node 18+ or pass options.fetch");

    const body = {
        object: {
            core: { version: "latest", ...app },
            configurationToOverride: o.configurationToOverride || {}
        },
        expiry: o.expiryMs || 60000,
        client: app.userName
    };

    const response = await doFetch(o.endpoint || TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Auth " + o.apiKey },
        body: JSON.stringify(body)
    });

    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (e) {
        e3dsNpmWarn("[E3DS] createSessionToken(): the answer was not JSON (" + (e && e.message) + ")");
    }

    if (!response.ok || !data || data.error) {
        const said = data && (data.error || data.message);
        const err = new Error("[E3DS] the token request was refused: " + response.status + " "
            + (typeof said === "string" ? said : said ? JSON.stringify(said) : (text || "").slice(0, 300)));
        err.status = response.status;
        err.response = data || text;
        throw err;
    }
    return data;
}

/**
 * Start a stream with a session token. Loads the SDK first if needed.
 *
 * @param {object} tokenData What createSessionToken() (or your own server) returned.
 * @param {object} [options]
 * @param {string} [options.userName] The account the token was created for
 *        (application.userName). Needed when tokenData does not carry it.
 * @returns {Promise<object>} What e3ds_controller.main() returned.
 */
export async function startStream(tokenData, options = {}) {
    const controller = await loadE3dsSdk(options);
    const client = options.userName || (tokenData && (tokenData.client || tokenData.userName));
    return controller.main({ ...(tokenData || {}), client });
}

export default { loadE3dsSdk, createSessionToken, startStream, getController, VERSION, CDN_URL, TOKEN_ENDPOINT, SDK_FILE, PACKAGE_NAME, PLAYER_ELEMENT_ID };
