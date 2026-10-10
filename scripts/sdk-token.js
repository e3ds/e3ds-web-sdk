/**
 * sdk-token.js — getting permission to start a stream.
 *
 * ── Why a token is needed at all ───────────────────────────────────────────
 *
 * You do not start a stream directly. The player needs a short-lived SESSION
 * TOKEN, which says: this person may start this app, once, within the next
 * minute.
 *
 * ── Two different things, two different names ──────────────────────────────
 *
 * STREAMING API KEY - what your account is issued, from the Developer section
 *   of the Control Panel. It does not expire and it can start sessions billed
 *   to you. This is the thing you keep.
 *
 * SESSION TOKEN - what the player actually consumes. Single use, expires on its
 *   own, and therefore safe to put in a browser. You exchange the key for one.
 *
 * They are not interchangeable, and confusing them is the usual reason a first
 * integration does not work: the player is handed a key and rejects it.
 *   https://learn.eagle3dstreaming.com/wiki/api-keys-and-tokens
 *
 * ── Three ways to get a token ──────────────────────────────────────────────
 *
 * 1. BY HAND, NO CODE AT ALL
 *    The Token Generation tab issues one directly, which is the quickest way to
 *    check that an app streams before writing any integration.
 *      https://controlpanel.eagle3dstreaming.com/developer-section
 *
 * 2. FROM THE BROWSER (what this demo does)
 *    Call the endpoint below with your Streaming API Key. No server needed, and
 *    fine for local experiments and internal demos. The cost is that the key
 *    sits in the page where any visitor can read it.
 *
 * 3. FROM YOUR OWN SERVER (what to do in production)
 *    Your server keeps the key, calls this same endpoint, and returns only the
 *    token to the page. Replace the fetch() below with a call to your own
 *    endpoint - nothing else in this file or the demo needs to change.
 *
 * See the warning at the top of sdk-config.js for the full reasoning.
 */

/** The endpoint that issues session tokens. */
const TOKEN_ENDPOINT = "https://token.eagle3dstreaming.com/api/v2/token/create";

/**
 * Check that sdk-config.js has actually been filled in.
 *
 * Done before the network call, and separately per field, so that a missed
 * setting produces a message naming exactly which one - rather than a confusing
 * rejection from the server, or a stream that silently never starts.
 *
 * @returns {string[]} One message per problem found, empty when the
 *          configuration is usable. Callers test `.length`, so an empty array
 *          is the success case - it does not return a boolean.
 */
function e3dsConfigProblems() {
    const problems = [];

    /* e3dsEffectiveApiKey() when demo-ui-connection-setup.js is present, so a key typed
     * into the panel counts as configured. Falls back to the raw constant when
     * the panel file is not loaded, which keeps this file usable on its own. */
    const key = (typeof e3dsEffectiveApiKey === "function")
        ? e3dsEffectiveApiKey()
        : STREAMING_API_KEY;

    if (!key || key === "Your Streaming API Key") {
        problems.push('STREAMING_API_KEY is still the placeholder. Paste your real key from the dashboard into sdk-config.js.');
    }


    if (!STREAMING_CONFIG.application.appName) {
        problems.push('application.appName is empty. Set it to your app\'s name exactly as it appears in the dashboard.');
    }

    if (!STREAMING_CONFIG.application.configurationName) {
        problems.push('application.configurationName is empty. "0" is the default configuration.');
    }

    return problems;
}


/**
 * [E3DS-TOKEN-ERROR] Tell the viewer a token request failed, and let them fix it.
 *
 * An alert, because this is fatal to the session and there is nothing else on
 * screen to attach a message to - the stream never starts, so there is no player
 * to put an overlay on.
 *
 * Then reopen the connection panel where one exists. An authentication failure
 * is almost always a wrong or stale API key, and the panel is where that key is
 * entered - sending someone to devtools to discover that is the difference
 * between a thirty second fix and a support ticket. Only for the statuses that
 * mean "your credentials", never for a 500, where retyping the key would be
 * pointless and misleading.
 */
function e3dsReportTokenFailure(detail, status) {
    try { alert("Eagle 3D Streaming — could not start the session.\n\n" + detail); }
    catch (e) { /* an alert must never be the thing that breaks the page */ }

    const looksLikeCredentials = status === 401 || status === 403 || status === 400;
    if (looksLikeCredentials && typeof e3dsOpenConnectionSetup === "function") {
        try { e3dsOpenConnectionSetup(); } catch (e) { /* panel is optional */ }
    }
}

/**
 * Exchange the Streaming API Key for a session token.
 *
 * The key identifies your account; the token is what the player consumes. See
 * the header of this file for why those are separate, and
 * https://learn.eagle3dstreaming.com/wiki/api-keys-and-tokens
 *
 * @param {string} [appNameOverride] Start a different app than the one in
 *        sdk-config.js. Useful when one page offers a choice of apps.
 * @returns {Promise<object|null>} The token data to hand to the player, or null
 *          if something went wrong (the reason is logged to the console).
 */
async function requestSessionToken(appNameOverride) {
    /* ASK, DO NOT REFUSE.
     *
     * This used to alert("STREAMING_API_KEY is still the placeholder") and
     * stop, which is a dead end for anyone who opened the demo from a hosted
     * URL and cannot edit sdk-config.js at all. Now an unfilled config opens a
     * panel, and the demo continues as soon as it is filled in - no reload, no
     * second click.
     *
     * Editing sdk-config.js still works exactly as before and wins wherever it is
     * set; the panel only fills gaps. See demo-ui-connection-setup.js.
     */
    let problems = e3dsConfigProblems();
    if (problems.length > 0 && typeof e3dsShowConnectionSetup === "function") {
        await e3dsShowConnectionSetup(problems);
        problems = e3dsConfigProblems();
    }
    if (problems.length > 0) {
        /* Still wrong after asking - or the panel was never loaded. Report it
         * the old way rather than failing silently. */
        const message = "Eagle 3D Streaming — configuration problem:\n\n• " + problems.join("\n• ");
        console.error(message);
        alert(message);
        return null;
    }

    // Copied rather than modified in place: overriding the app for one call
    // should not quietly change the configuration for every later call.
    const application = { ...STREAMING_CONFIG.application };
    if (appNameOverride) application.appName = appNameOverride;

    const requestBody = {
        object: {
            core: application,
            configurationToOverride: STREAMING_CONFIG.configurationToOverride
        },
        expiry: STREAMING_CONFIG.tokenExpiryMs,
        client: STREAMING_CONFIG.application.userName
    };

    try {
        const response = await fetch(TOKEN_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                /* The panel's key when sdk-config.js was left unfilled. */
                "Authorization": "Auth " + ((typeof e3dsEffectiveApiKey === "function")
                    ? e3dsEffectiveApiKey() : STREAMING_API_KEY)
            },
            body: JSON.stringify(requestBody)
        });

        // Checked explicitly: fetch() only rejects when the network itself
        // fails, so without this an HTTP 401 or 500 would sail through and fail
        // later as a confusing "cannot read property of undefined".
        if (!response.ok) {
            /* [E3DS-TOKEN-ERROR] SHOW the refusal, and show what the server said.
             *
             * This used to console.error and return null. On a wrong API key
             * that produced a page which simply did nothing - no message, no
             * alert, no hint that a key was even involved. The one person who
             * needs to know is the one who just typed the key in, and they are
             * not watching the console on a phone.
             *
             * The BODY is read, not just the status. A 401 says "refused"; the
             * body says WHY - wrong key, expired, unknown app, quota - and that
             * sentence is the difference between fixing it and guessing. It was
             * being discarded unread. */
            let serverSaid = "";
            try {
                serverSaid = (await response.text() || "").trim();
                try {
                    const asJson = JSON.parse(serverSaid);
                    serverSaid = asJson.error || asJson.message || serverSaid;
                } catch (e) { /* not JSON - the raw text is what we have */ }
            } catch (e) { /* body already consumed or unreadable */ }

            const detail = `The server refused the request: ${response.status} ${response.statusText}`
                + (serverSaid ? `\n\n${serverSaid.slice(0, 400)}` : "");
            console.error("Token request failed. " + detail);
            e3dsReportTokenFailure(detail, response.status);
            return null;
        }

        const data = await response.json();

        if (data.error) {
            /* Same treatment: a 200 carrying an error is still a refusal. */
            const detail = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
            console.error("Token request rejected:", detail);
            e3dsReportTokenFailure("The server rejected the request:\n\n" + detail, 200);
            return null;
        }

        return data;

    } catch (error) {
        // Reached when the request could not be made at all - no connection, or
        // the page was opened from the file system instead of a web server.
        console.error("Token request failed:", error);
        return null;
    }
}

/**
 * Start a streaming session.
 *
 * The ONE place that knows how to hand a token to the player. Both the
 * auto-start below and the Restart button call this, so the argument list
 * main() needs is written once and cannot drift between them.
 *
 * [E3DS-SDK-CLIENT] The viewer identity is passed IN rather than left for the
 * player to find. There used to be a separate `clientUserName` field in
 * sdk-config.js as well; it always held the same value as
 * application.userName, so it was removed and this reads the one that is left.
 *
 * The player also used to read a global named `clientUserName`,
 * which only ever worked because the sample file happened to spell it that way
 * - STREAMING_CONFIG is a `const` and never becomes a window property, so that
 * global does not exist inside the player at all.
 *
 * Spread first so a `client` field from the API, if it ever returns one, is
 * what gets overridden rather than the other way round - this value is the one
 * the token was actually created with (see requestSessionToken), and
 * token/verify looks the token up by it. Get it wrong and verification answers
 * 404 for a token that is perfectly good.
 *
 * @param {object} [tokenData] A token already fetched by the caller. Restart
 *        fetches its own BEFORE tearing down the running session, so that a
 *        failed request leaves the viewer watching what they already had.
 *        Omit it and one is requested here.
 * @returns {Promise<boolean>} Whether the session was started.
 */


async function startStream(attempts = 3) {
    /* [E3DS-END-SCREEN-CLEAR] Clear any previous session's end screen FIRST.
     *
     * Every route to a new session comes through here - the first load, the
     * demo's Restart button, anything added later - so clearing it here covers
     * all of them. Doing it in the Restart handler instead would have been one
     * more place to remember, and the reported bug is what forgetting looks
     * like: a new stream playing underneath an overlay nobody could dismiss.
     *
     * At the top rather than on success: the viewer has asked for a new
     * session, so the old one's ending is no longer the thing to show them,
     * whether or not the token request works. If it fails, the failure path
     * gets to say so on a clean page. */
    try { if (typeof e3dsHideEndScreen === "function") e3dsHideEndScreen(); } catch (e) { }

    for (let i = 0; i < attempts; i++) {
        const tokenData = await requestSessionToken();
        if (tokenData) {
            e3ds_controller.main({ ...tokenData, client: STREAMING_CONFIG.application.userName });
            return true;
        }
        console.warn("Token request failed (attempt " + (i + 1) + " of " + attempts + ").");
        if (i < attempts - 1) await new Promise(r => setTimeout(r, 2000));
    }
    console.error("Could not get a session token after " + attempts + " tries.");
    return false;
}

  startStream();