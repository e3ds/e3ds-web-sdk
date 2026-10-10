/**
 * sdk-callbacks.js — reacting to what the stream does.
 *
 * The SDK tells your page what is happening by calling functions you provide.
 * You assign them to `e3ds_controller.callbacks`, and the SDK calls them when
 * the matching thing happens.
 *
 * EVERY ONE OF THESE IS OPTIONAL. Assign only the ones you care about; the
 * others simply never get called. They are all listed here, with their purpose,
 * so you can see the full set in one place.
 *
 * The ones most integrations actually use:
 *   onDataChannelOpen        the stream is live and ready for your commands
 *   onResponseFromUnreal     your app sent something back to the page
 *   onSessionEnding          the stream is ending - show your own screen
 */

/* ── Starting up ────────────────────────────────────────────────────────── */

/**
 * The configuration has been received from the platform.
 *
 * Early: the stream is not playing yet. Useful for preparing your interface
 * before video appears.
 */
/* Reference: https://learn.eagle3dstreaming.com/wiki/sdk-reference#onConfigAcquire */
e3ds_controller.callbacks.onConfigAcquire = function () {
    console.log("[E3DS] Configuration received.");
    e3dsLogAppResponse(null, "in", "onConfigAcquire - configuration received");
};

/**
 * Progress while the app is being downloaded onto the streaming machine.
 *
 * Only happens when the app is not already on the machine, so a warm machine
 * may skip this entirely. Do not assume it always runs.
 *
 * @param {number} percent 0 to 100.
 */
/* Reference: https://learn.eagle3dstreaming.com/wiki/sdk-reference#onReceivingAppAcquiringProgress */
e3ds_controller.callbacks.onReceivingAppAcquiringProgress = function (percent) {
    console.log(`[E3DS] Downloading the app: ${percent}%`);
    e3dsLogAppResponse(null, "in", "onReceivingAppAcquiringProgress " + percent + "%");
};

/**
 * Progress while the downloaded app is unpacked and prepared.
 *
 * Like the download step, this may not happen at all.
 *
 * @param {number} percent 0 to 100.
 */
/* Reference: https://learn.eagle3dstreaming.com/wiki/sdk-reference#onReceivingAppPreparationProgress */
e3ds_controller.callbacks.onReceivingAppPreparationProgress = function (percent) {
    console.log(`[E3DS] Preparing the app: ${percent}%`);
    e3dsLogAppResponse(null, "in", "onReceivingAppPreparationProgress " + percent + "%");
};

/**
 * Progress while the app is launching.
 *
 * @param {number} percent 0 to 100.
 */
/* Reference: https://learn.eagle3dstreaming.com/wiki/sdk-reference#onReceivingAppStartingProgress */
e3ds_controller.callbacks.onReceivingAppStartingProgress = function (percent) {
    console.log(`[E3DS] Starting the app: ${percent}%`);
};

/* ── Running ───────────────────────────────────────────────────────────── */

/**
 * The stream is live and the two-way data channel is open.
 *
 * THIS IS THE ONE TO BUILD ON. Before it fires, commands you send to the app
 * have nowhere to go; after it, everything works. It is the right moment to
 * hide your loading screen and show your controls.
 *
 * This demo builds its buttons here - see demo-ui-controls.js.
 */
/* Reference: https://learn.eagle3dstreaming.com/wiki/sdk-reference#onDataChannelOpen */
e3ds_controller.callbacks.onDataChannelOpen = function () {
    console.log("[E3DS] Stream is live.");
    e3dsLogAppResponse(null, "in", "onDataChannelOpen - the stream is live");
    buildDemoControls();
};

/**
 * The data channel closed — no more messages can be exchanged.
 *
 * Note this says nothing about WHY. For a reason to show the visitor, use
 * onSessionEnding below.
 */
/* Reference: https://learn.eagle3dstreaming.com/wiki/sdk-reference#onDataChannelClose */
e3ds_controller.callbacks.onDataChannelClose = function () {
    console.log("[E3DS] Data channel closed.");
    e3dsLogAppResponse(null, "in", "onDataChannelClose");

    /* Everything that talks to Unreal goes through this channel, so those
     * buttons cannot work any more - resolution, quality, the stat overlays,
     * character and skin. Removing them is more honest than leaving controls
     * that silently do nothing. Terminate and Restart stay: the session may
     * still exist, and Restart works even when it does not. */
    /* A restart terminates the old session and starts a new one, so THIS close
     * can arrive after the new session is already building its buttons - the
     * console showed exactly that: config received, then the old channel
     * closing, then seven buttons removed from a session that was fine.
     * demoRestartInProgress is set for the length of that handover. */
    if (typeof demoRestartInProgress !== "undefined" && demoRestartInProgress) {
        console.log("[E3DS] Ignoring the channel close: it belongs to the " +
            "session being replaced, not the one starting.");
        return;
    }
    removeDemoButtonsNeeding("channel");
};

/**
 * Your Unreal application sent something back to the page.
 *
 * This is where your own integration logic goes: react to what the app reports,
 * update your interface, and so on.
 *
 * @param {string|object} descriptor Whatever your app chose to send.
 */
/* Reference: https://learn.eagle3dstreaming.com/wiki/sdk-reference#onResponseFromUnreal */
e3ds_controller.callbacks.onResponseFromUnreal = function (descriptor) {
    console.log("[E3DS] Your app replied:", descriptor);
    e3dsLogAppResponse(descriptor, "in", "onResponseFromUnreal - from your app");
};

/* ── Ending ────────────────────────────────────────────────────────────── */

/**
 * The stream is ending — USE THIS ONE for a "stream ended" screen.
 *
 * Fires for essentially any reason a session ends: the app crashed, the visitor
 * was idle too long, the session or link expired, a password was wrong, and so
 * on. `message` is a short line of text meant for a person to read.
 *
 * It arrives just before the platform's own plain "ended" page would appear,
 * which is your opportunity to show something of your own instead.
 *
 * DO show `message` to the visitor, or ignore it and show your own wording.
 * This sample does the former: it puts the message on screen in an overlay,
 * which you are meant to replace with your own - see the marked block below.
 * DO NOT write code that inspects the wording to work out what happened - treat
 *        it as text for a person, since the exact wording can change.
 *
 * Note the stream ending cannot be cancelled or delayed by anything this
 * function does. Design your screen around "this is happening regardless".
 *
 * @param {string} message A short explanation for the visitor.
 */
/* Every value `message` can take, and what causes each:
 *   https://learn.eagle3dstreaming.com/wiki/session-end-messages
 *
 * A link and not a list, deliberately. The same set reaches the iframe bridge,
 * so a copy here would be the second of three - and the one nobody remembers
 * to update when an ending is added. */
/* Renamed from the old end-of-session callback. If you copied an older version
 * of this file, rename your handler - same moment, same single string argument,
 * nothing else changes. */
/* [E3DS-END-SCREEN-CLEAR] Take the end screen down again.
 *
 * It was only ever put UP. Nothing anywhere removed it, so once a session ended
 * the overlay covered the page for the rest of its life - the NEXT session
 * included. Reported exactly that way: Restart started a new stream, the video
 * was playing underneath, and the only way to see it was to delete the element
 * by hand in the developer tools.
 *
 * sdk-token.js calls it. These are plain classic scripts sharing one global
 * scope, so the declaration below is all that is required - no `window.`
 * assignment, which is what used to be here. */
function e3dsHideEndScreen() {
    var overlay = document.getElementById("e3dsEndScreen");
    if (overlay && overlay.remove) overlay.remove();
}

function e3dsOnSessionEnding(message) {
    console.log("[E3DS] The stream is ending:", message);
    e3dsLogAppResponse(message, "in", "onSessionEnding");

    /* The session is definitively over - this fires for every reason one ends.
     * Terminate has nothing left to terminate, so it goes.
     *
     * Restart deliberately stays. It fetches a fresh token and starts a new
     * session, so it works with no session at all - it is the only useful
     * action left on the page, and removing it would leave the viewer with an
     * end screen and no way forward. */
    removeDemoButtonsNeeding("channel");
    removeDemoButtonsNeeding("session");

    /* ▼▼ THIS IS THE PART YOU REPLACE ▼▼
     *
     * What follows is a working end screen so the demo shows something real
     * rather than logging to a console nobody has open. It is deliberately
     * plain: your own version should match your product, not this one.
     *
     * To make it yours, either edit what is below, or delete all of it and
     * show a screen that already exists in your page:
     *
     *     document.getElementById("myEndScreen").style.display = "flex";
     *     document.getElementById("myEndMessage").innerText = message;
     *
     * Everything here is built in JavaScript rather than written into the
     * page's HTML, so that copying this one function into your own project is
     * enough to make it work - there is no markup you must remember to add.
     */

    var overlay = document.getElementById("e3dsEndScreen");
    if (overlay) return;                    // already showing - do not stack

    overlay = document.createElement("div");
    overlay.id = "e3dsEndScreen";
    overlay.setAttribute("role", "alertdialog");
    overlay.setAttribute("aria-live", "assertive");
    /* [E3DS-END-SCREEN-POPUP] A small popup, NOT a full-screen layer.
     *
     * This used to be inset:0 with a near-opaque backdrop, which covered the
     * whole page - so the demo panel behind it was visible but unclickable, and
     * it stayed over the next session too. Every complaint about the end screen
     * came from the backdrop, not from the message.
     *
     * It sits in the middle and covers only itself. Nothing behind it is
     * blocked, so the panel's own Restart stays reachable. */
    overlay.style.cssText = [
        "position:fixed", "left:50%", "top:50%", "transform:translate(-50%,-50%)",
        "z-index:2147483000", "max-width:min(420px,calc(100vw - 32px))",
        "font-family:Montserrat,sans-serif", "color:#f0f0f0",
        "opacity:0", "transition:opacity .25s ease",
    ].join(";");

    var card = document.createElement("div");
    card.style.cssText = [
        "text-align:center", "background:rgba(32,32,32,.96)",
        "border:1px solid rgba(255,255,255,.12)", "border-radius:10px",
        "padding:20px 24px", "box-shadow:0 10px 40px rgba(0,0,0,.5)",
    ].join(";");

    var title = document.createElement("h2");
    title.textContent = "The session has ended";
    title.style.cssText = "margin:0 0 8px;font-size:16px;font-weight:600;line-height:1.3";

    /* textContent, never innerHTML: the message comes from the platform and is
     * meant to be read, not executed. */
    var body = document.createElement("p");
    body.textContent = message || "";
    body.style.cssText = "margin:0;font-size:14px;line-height:1.5;color:#d8d8d8";

    card.appendChild(title);
    card.appendChild(body);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.style.opacity = "1"; });
}

/* Reference: https://learn.eagle3dstreaming.com/wiki/sdk-reference#onSessionEnding
 * Every message it can receive: https://learn.eagle3dstreaming.com/wiki/session-end-messages */
e3ds_controller.callbacks.onSessionEnding = e3dsOnSessionEnding;

/**
 * The streamed app itself stopped running — optional, a yes/no signal.
 *
 * Fires only on a genuine crash, unexpected close, or the machine going down —
 * NOT for an ordinary end of session. It carries no message, only the fact.
 *
 * Use it for a simple decision, such as whether an automatic reconnect is worth
 * attempting. Do not build anything essential on it: it does not fire for most
 * ways a session ends, and it can arrive too late to be useful.
 * onSessionEnding above is the dependable one.
 */
/* Reference: https://learn.eagle3dstreaming.com/wiki/sdk-reference#onStreamerDisconnected */
e3ds_controller.callbacks.onStreamerDisconnected = function () {
    console.log("[E3DS] The app has stopped running.");
    e3dsLogAppResponse(null, "in", "onStreamerDisconnected - the app stopped");
};

/**
 * The session reached its time limit.
 *
 * Send the visitor wherever suits your site, or offer them a fresh session.
 * This demo only logs it, so that it works as-is without extra pages - replace
 * this with your own handling.
 */
/* Reference: https://learn.eagle3dstreaming.com/wiki/sdk-reference#onSessionExpired */
e3ds_controller.callbacks.onSessionExpired = function () {
    console.log("[E3DS] The session expired.");
    e3dsLogAppResponse(null, "in", "onSessionExpired");

    // For example:
    //   window.location = "/session-expired.html";
};

/* ── Not currently functional ──────────────────────────────────────────────
 *
 * These two exist in the SDK but do not currently do anything. They are
 * documented here so that you do not spend time wiring up something that will
 * never be called.
 *
 *   onError    - would report an error message. Use onSessionEnding.
 *   onHtmlBind - would report when the page is ready to bind controls to. Use
 *                onDataChannelOpen (stream live) or onConfigAcquire (settings
 *                received) instead.
 *
 * There is also a `preventErrorRedirect` setting which does not work either;
 * the stream cannot currently be prevented from ending.
 */
