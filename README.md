# Eagle 3D Streaming — Web SDK

Stream a cloud-rendered Unreal Engine application straight into your own web
page, and control it from JavaScript.

The stream renders **directly in your page**, not inside an iframe, so you have
full programmatic control: start and stop sessions, send data to the
application, react to what it sends back, and change quality while it runs.

Plain HTML, CSS and JavaScript. No build step, no framework, no `npm install`.

---

## Try it first

**[demo-sdk.eaglepixelstreaming.com](https://demo-sdk.eaglepixelstreaming.com/)**

That is this repository, deployed and running: a live stream, the demo control
panel, and every callback firing against a real session — without cloning
anything or entering a key.

Its address is deliberate. The page is served from `eaglepixelstreaming.com`
while the platform it streams from is `connector.eagle3dstreaming.com` — two
different origins. Nothing here requires your page to sit on an Eagle 3D
Streaming domain, and hosting the demo elsewhere proves that rather than
claiming it.

---

## Quick start

**1. Add your API key** in `scripts/sdk-config.js`:

```js
const STREAMING_API_KEY = "Your Streaming API Key";
```

**2. Point it at your application**, in the same file. Every value comes from
your Control Panel and must match exactly, capitalisation included:

```js
application: {
    domain: "connector.eagle3dstreaming.com",   // the connector your account was issued
    userName: "your-username",                  // the account that owns the app
    appName: "YourAppName",                     // exactly as the dashboard shows it
    configurationName: "your-configuration",    // the stored configuration to launch
    version: "latest"                           // or a specific version
}
```

**3. Open `index.html`.** Double-click it — no server, no build, no install. The
stream starts by itself. Press **F12** to watch it in the console.

---

## What is in here

| | |
|---|---|
| `index.html` | the page, and the order the scripts load in |
| `scripts/sdk-config.js` | your key, and which application to stream |
| `scripts/sdk-token.js` | turns the key into a short-lived session token |
| `scripts/sdk-callbacks.js` | the events the stream sends you |
| `scripts/dist/e3dsCore.min_ns.js` | the SDK itself |
| `scripts/demo-ui-*.js` | **demo only** — the control panel and the settings dialog. Delete them and the stream still works. |

`sdk-*` is what you integrate. `demo-ui-*` is the demo wrapped around it.

---

## Documentation

Everything else is in one place, kept current:

### **[learn.eagle3dstreaming.com](https://learn.eagle3dstreaming.com/)**

- [Web SDK demo manual](https://learn.eagle3dstreaming.com/wiki/web-sdk-demo-manual) — this repository, page by page: what each part does and how to run it
- [Web SDK reference](https://learn.eagle3dstreaming.com/wiki/javascript-sdk-guide) — every call and every callback, in the order they happen
- [Set up the Web SDK](https://learn.eagle3dstreaming.com/wiki/embed-stream-using-e3ds-sdk) — moving from this sample into your own application
- [Streaming API key and tokens](https://learn.eagle3dstreaming.com/wiki/streaming-api-key-and-tokens) — **read this before you go live.** A key shipped to the browser can be read by anyone who visits the page.
- [Keeping your API key off the browser](https://learn.eagle3dstreaming.com/wiki/sdk-secure-the-key) — how to serve the token from your own server instead
- [iframe or Web SDK](https://learn.eagle3dstreaming.com/wiki/iframe-or-web-sdk) — the other way to embed, and when it is the better one

---

## Support

[Discord](https://discord.com/invite/hMwR2Uxr33) · support@eagle3dstreaming.com
