/**
 * sdk-config.js — everything you need to change to run this against your own app.
 *
 * This is the only file you have to edit to get started. The rest of the demo
 * reads its settings from here.
 */

/**
 * ⚠️  YOUR API KEY — READ THIS BEFORE YOU DEPLOY ANYTHING  ⚠️
 *
 * Get this from your Eagle 3D Streaming dashboard and paste it below.
 *
 * BE AWARE OF WHAT THIS MEANS: anything in a web page is visible to anyone who
 * visits it. A key placed here can be read by any visitor using their browser's
 * developer tools. That is acceptable for a local experiment or an internal
 * demo, and it is why this demo is written the way it is.
 *
 * For anything public, DO NOT ship your key to the browser. Instead:
 *
 *   1. Keep the key on your own server, where visitors cannot read it.
 *   2. Have your server call the token endpoint (see sdk-token.js) and
 *      return only the resulting short-lived token to the page.
 *   3. Point requestSessionToken() at your own endpoint instead of calling
 *      Eagle 3D Streaming's directly.
 *
 * The token itself is safe to send to the browser: it expires quickly and is
 * scoped to a single session. The API key is not - it does not expire, and it
 * can be used to start sessions billed to your account.
 *
 * NEVER commit a real key to a public repository. If you ever have, treat it
 * as compromised and issue a new one from the dashboard.
 *
 * Where this comes from, and how it differs from a session token:
 *   https://learn.eagle3dstreaming.com/wiki/api-keys-and-tokens
 *   https://controlpanel.eagle3dstreaming.com/developer-section
 *
 * That second link is also the quickest way to test without writing anything:
 * the Token Generation tab hands you a session token directly, so you can
 * confirm an app streams before integrating at all.
 */
const STREAMING_API_KEY = "Your Streaming API Key";

/**
 * Which application to stream, and to whom.
 */
const STREAMING_CONFIG = {
    /**
     * How long the generated token stays valid, in milliseconds.
     *
     * Short is good: the token only needs to survive long enough for the page
     * to start its session. 60000 (one minute) is a sensible default.
     */
    tokenExpiryMs: 60000,

    /**
     * The application to launch. Every field here comes from your Eagle 3D
     * Streaming dashboard - they must match exactly, including capitalisation.
     */
    application: {
        /** The connector your account was given, e.g. "connector.eagle3dstreaming.com". */
        domain: "connector.eagle3dstreaming.com",

        /** The account that owns the app, and the name the session is
         *  recorded against. One username, used for both. */
        userName: "your-username",

        /** The app's name exactly as it appears in your dashboard. */
        appName: "YourAppName",

        /** Which stored configuration to launch with. "0" is the default one. */
        configurationName: "your-configuration",

        /** A specific version, or "latest" to always use the newest. */
        version: "latest"
    },

    /**
     * Optional per-session overrides of that stored configuration.
     *
     * Leave empty to use the dashboard's settings as they are. Anything you put
     * here applies to this session only and does not change the saved
     * configuration.
     */
    configurationToOverride: {}
};
