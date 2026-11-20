/* Bundled with Vite: the SDK file inside the package is emitted as an asset
 * and injected as a <script>. Nothing is fetched from GitHub or a CDN. */
import { loadE3dsSdk, startStream, VERSION, PACKAGE_NAME } from "@eagle3dstreaming/web-sdk";

const status = document.getElementById("status");
const params = new URLSearchParams(location.search);

loadE3dsSdk().then(async (e3ds) => {
    e3ds.callbacks.onDataChannelOpen = () => { status.textContent = "stream is live"; };
    e3ds.callbacks.onSessionEnding = (message) => { status.textContent = "ended: " + message; };

    const scriptTag = document.querySelector("script[data-e3ds-sdk]");
    window.__e3dsTest = {
        ok: true,
        package: PACKAGE_NAME + "@" + VERSION,
        loadedFrom: scriptTag ? scriptTag.src : null,
        methods: Object.keys(e3ds).filter((k) => typeof e3ds[k] === "function").sort(),
        /* main() without a token must refuse and say what is missing. */
        mainWithoutToken: e3ds.main({})
    };
    status.textContent = PACKAGE_NAME + "@" + VERSION + " loaded";

    /* Optional live run: ?token=...&socket_url=...&user=... from the Control Panel's
     * Developer section > Token Generation. No key in this page. */
    if (params.get("token") && params.get("socket_url")) {
        await startStream({ token: params.get("token"), socket_url: params.get("socket_url") },
            { userName: params.get("user") });
    }
}).catch((e) => {
    console.error("[example] loading the E3DS Web SDK failed:", e);
    window.__e3dsTest = { ok: false, error: String(e && e.message || e) };
    status.textContent = "failed: " + e.message;
});
