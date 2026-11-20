# @eagle3dstreaming/web-sdk

The **Eagle 3D Streaming Web SDK** as an npm package. Stream a cloud-rendered
Unreal Engine application straight into your own web page (no iframe) and
control it from JavaScript: start and end sessions, send data to the app,
react to what it sends back, change quality while it runs.

```bash
npm install @eagle3dstreaming/web-sdk
```

Works with any bundler (Vite, webpack 5, Rollup, Parcel, Next.js client
components), with plain `<script>` tags, and from a CDN. TypeScript types are
included.

---

## Quick start

### 1. Get a session token — on your server

A stream starts with a short-lived **session token**. You get one by exchanging
your **Streaming API key** (Control Panel → Developer section). The key does not
expire and starts sessions billed to you, so **keep it on your server**:

```js
// server.js (Node 18+)
import { createSessionToken } from "@eagle3dstreaming/web-sdk";

app.get("/e3ds-token", async (req, res) => {
  const token = await createSessionToken({
    apiKey: process.env.E3DS_STREAMING_API_KEY,
    application: {
      domain: "connector.eagle3dstreaming.com",  // the connector your account was issued
      userName: "your-username",                 // the account that owns the app
      appName: "YourAppName",                    // exactly as the Control Panel shows it
      configurationName: "your-configuration",   // the stored configuration to launch
      version: "latest"
    }
  });
  res.json(token);
});
```

(`require("@eagle3dstreaming/web-sdk")` works too.)

### 2. Start the stream — in the page

```html
<div id="playerUI" style="position:fixed; inset:0"></div>
```

```js
import { loadE3dsSdk, startStream } from "@eagle3dstreaming/web-sdk";

const e3ds = await loadE3dsSdk();          // loads the SDK into the page, once

e3ds.callbacks.onDataChannelOpen = () => {
  // the stream is live - your commands now reach the app
  e3ds.sendMessageToStreamingBuild({ action: "setColour", colour: "red" });
};
e3ds.callbacks.onResponseFromUnreal = (descriptor) => console.log("app says", descriptor);
e3ds.callbacks.onSessionEnding = (message) => showMyEndScreen(message);

const token = await fetch("/e3ds-token").then((r) => r.json());
await startStream(token, { userName: "your-username" });
```

For a quick local test you can call `createSessionToken()` in the browser
instead of on a server; it works, but anyone who opens the page can read the
key, and the package prints a warning saying so.

### Without a bundler

```html
<div id="playerUI"></div>
<script src="https://cdn.jsdelivr.net/npm/@eagle3dstreaming/web-sdk@1/dist/e3dsCore.min_ns.js"></script>
<script>
  e3ds_controller.callbacks.onDataChannelOpen = function () { /* ... */ };
  e3ds_controller.main({ token: "...", socket_url: "...", client: "your-username" });
</script>
```

or `node_modules/@eagle3dstreaming/web-sdk/dist/e3dsCore.min_ns.js` if you
serve `node_modules`.

---

## API

### This package

| | |
|---|---|
| `loadE3dsSdk(options?)` | Loads the SDK into the page and resolves to `e3ds_controller`. Safe to call any number of times (React StrictMode included). Creates `<div id="playerUI">` if the page has none. Options: `src` (load the SDK from your own address), `timeoutMs` (default 30000), `cdnFallback` (default `true`). Browser only. |
| `createSessionToken(options)` | Exchanges the API key for a session token. Node 18+ or browser. Options: `apiKey`, `application { domain, userName, appName, configurationName, version }`, `configurationToOverride`, `expiryMs` (default 60000), `endpoint`, `fetch`. Throws an `Error` with `status` and the server's reason when refused. |
| `startStream(token, options?)` | Loads the SDK if needed and calls `e3ds_controller.main()` with the token. `options.userName` = the account the token was made for. |
| `getController()` | `e3ds_controller` once loaded, otherwise `undefined`. |
| `VERSION`, `CDN_URL`, `TOKEN_ENDPOINT`, `SDK_FILE`, `PLAYER_ELEMENT_ID` | Constants. |

How the SDK is loaded, first one that works:

1. `options.src`, if you give one (then nothing else is tried);
2. the SDK file inside this package, emitted by your bundler (the standard
   `new URL(..., import.meta.url)` asset pattern) and added as a `<script>` —
   what a production build of Vite / webpack / Rollup uses;
3. the same SDK inside this package as text, run as an inline `<script>`
   (downloaded as a separate chunk only when needed) — what a dev server that
   pre-bundles packages, such as `vite dev`, ends up using;
4. the same version from jsDelivr (`CDN_URL`). `cdnFallback: false` turns this off.

With `require()`, step 3 is not available. Under a strict
Content-Security-Policy without `'unsafe-inline'`, serve
`dist/e3dsCore.min_ns.js` yourself and pass its address as `src`.

### The SDK itself — `e3ds_controller`

| Call | |
|---|---|
| `main(token)` | start a session |
| `terminate()` | end the session and release the machine |
| `sendMessageToStreamingBuild(data)` | your own data to your Unreal app |
| `sendConsoleCommandToUE("stat fps")` | an Unreal console command |
| `sendCommandToUE(obj)` | Pixel Streaming plugin command channel |
| `setResolution(w, h)` / `useViewportResolution()` | pin / unpin the resolution |
| `setVideoDetailLevel("low" \| "medium" \| "high" \| "ultra")` | quality preset |
| `setQualityPoint(qp)` / `setAdaptiveQualityPoint(min, max)` | encoder quality |
| `switchMouseControlSchemeTo(scheme)`, `setTouchInputEnabled(bool)` | input |
| `setVolume(0..1)`, `toggleFullscreen()`, `captureScreenShot()` | |
| `setConnectionStatsInterval(seconds)` | how often `onConnectionStats` fires |

Callbacks (all optional), set on `e3ds_controller.callbacks`:
`onConfigAcquire`, `onReceivingAppAcquiringProgress(percent)`,
`onReceivingAppPreparationProgress(percent)`,
`onReceivingAppStartingProgress(percent)`, `onDataChannelOpen`,
`onDataChannelClose`, `onResponseFromUnreal(descriptor)`,
`onSessionEnding(message)`, `onSessionExpired`, `onStreamerDisconnected`,
`onEvent(event)`, `onConnectionStats(stats)`, `onStreamFocusGained`,
`onStreamFocusLost`.

Full reference, in the order things happen:
<https://learn.eagle3dstreaming.com/wiki/javascript-sdk-guide>

**Good to know:** the player renders into `#playerUI` and moves that element
to the end of `<body>`. Give it fixed or absolute positioning rather than
relying on where it sits in your component tree.

---

## Versions and updates

The package follows [semantic versioning](https://semver.org/):

- **patch** (1.0.x) — fixes, no change to how you call it
- **minor** (1.x.0) — new calls or callbacks; existing code keeps working
- **major** (x.0.0) — something you call changed; read the release notes

`npm install` saves `"^1.0.0"` in your `package.json`, so

```bash
npm update @eagle3dstreaming/web-sdk
```

brings in every new 1.x release (fixes and new features) and never a breaking
2.0. `npm outdated` shows when a new version is out. On a CDN, `@1` follows the
latest 1.x the same way; pin an exact version (`@1.0.0`) to freeze it.

---

## Links

- Live demo: <https://demo-web-sdk.eagle3dstreaming.com/>
- Source and demo page: <https://github.com/e3ds/e3ds-web-sdk>
- Keeping the key off the browser: <https://learn.eagle3dstreaming.com/wiki/sdk-secure-the-key>
- iframe or Web SDK: <https://learn.eagle3dstreaming.com/wiki/iframe-or-web-sdk>
- Support: support@eagle3dstreaming.com · [Discord](https://discord.com/invite/hMwR2Uxr33)
