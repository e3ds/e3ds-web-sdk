/**
 * demo-ui-controls.js — the demo's own buttons.
 *
 * ── Read this before copying anything from this file ───────────────────────
 *
 * None of this is required to run a stream. It exists to give you something to
 * click so you can watch each SDK call do something.
 *
 * What IS worth studying is the body of each button's handler - those one-line
 * calls are the entire public surface of the SDK, and they are listed together
 * in the README.
 *
 * The buttons are built in onDataChannelOpen (see sdk-callbacks.js), never
 * before: until the data channel is open, commands sent to the app have nowhere
 * to go, so offering a button earlier would only produce clicks that vanish.
 */

/**
 * Restart the stream: get a fresh token and start a new session.
 */
async function restartStream() {
    e3ds_controller.terminate();

    /* [E3DS-RESTART-TIDY] The THIRD way out of a session.
     *
     * removeDemoButtonsNeeding("session") is called from the Terminate button's
     * own click handler and from the session-ending callback. The note on the
     * Terminate button says "two ways out of a session, and only one of them was
     * tidying up" - it missed that restart is a third.
     *
     * terminate() tears down the STREAM; it knows nothing about this panel, so
     * calling it directly reaches neither cleanup. The data channel closing
     * cleared the "channel" controls, and the "session" ones - Volume,
     * Fullscreen, Screenshot - survived straight into the next session.
     *
     * Reported from a phone: mid-restart, with the page showing "WebRTC
     * connected, waiting for video", the panel still offered Volume, Fullscreen
     * and Screenshot for a stream that did not exist yet, while Terminate
     * removed them correctly. They are added back when the video arrives. */
    removeDemoButtonsNeeding("session");

    await startStream();
}


/**
 * Add one button to the demo's control panel.
 *
 * @param {string}   label    The button's visible text.
 * @param {Function} onClick  Runs when the button is clicked.
 */
/**
 * Add a labelled slider to the demo panel.
 *
 * Same panel and the same `needs` rule as addDemoButton, so a slider disappears
 * with its dependency exactly like a button does - see [E3DS-DEMO-NEEDS].
 *
 * @param {string}   label    Text shown to the left of the slider.
 * @param {object}   opts     { min, max, step, value }
 * @param {Function} onInput  Called with the numeric value as it moves.
 * @param {string}   needs    channel | session | always
 */
function addDemoSlider(label, opts, onInput, needs, category) {
    let buttonPanel = document.getElementById("demoButtonPanel");
    if (!buttonPanel) {
        /* addDemoButton builds the panel. Calling it for a slider would leave a
         * stray button, so the panel is created the same way here instead. */
        buttonPanel = document.createElement("div");
        buttonPanel.id = "demoButtonPanel";
        document.body.appendChild(buttonPanel);
        makePanelDraggable(buttonPanel);
    }

    const row = document.createElement("div");
    /* No demo-slider-row here: it was never styled and never selected, so it
       only suggested a hook that does not exist. The row borrows .demo-button
       deliberately, so a slider lines up with the buttons around it. */
    row.className = "demo-button";
    row.dataset.needs = needs || "channel";
    row.style.cssText = "display:flex;align-items:center;gap:.5rem;cursor:default;";

    /* The drag handler on the panel starts a drag on mousedown anywhere inside
     * it. Without this, grabbing the slider would drag the whole panel and the
     * value would never move. */
    row.addEventListener("mousedown", (e) => e.stopPropagation());

    const text = document.createElement("span");
    text.textContent = label;
    text.style.cssText = "white-space:nowrap;";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = opts.min;
    slider.max = opts.max;
    slider.step = opts.step;
    slider.value = opts.value;
    slider.style.cssText = "flex:1;min-width:6rem;cursor:pointer;";

    const readout = document.createElement("span");
    readout.style.cssText = "min-width:2.5rem;text-align:right;font-variant-numeric:tabular-nums;";
    const show = (v) => { readout.textContent = Math.round(v * 100) + "%"; };
    show(Number(opts.value));

    /* "input", not "change": change fires only when the drag ends, so the sound
     * would jump at the end instead of following the handle. */
    slider.addEventListener("input", () => {
        const v = Number(slider.value);
        show(v);
        onInput(v);
    });

    row.appendChild(text);
    row.appendChild(slider);
    row.appendChild(readout);
    e3dsSdkCategorySection(buttonPanel, category).appendChild(row);
    return row;
}

/* [E3DS-DEMO-CATEGORY] A button says which category it belongs to, and the
 * category appears if it does not already exist.
 *
 * WHY A PARAMETER RATHER THAN CALLING addDemoGroup FIRST. Grouping by call ORDER
 * means a button added later - when a stream connects, when an app is
 * identified, when a permission is granted - lands wherever the cursor happens
 * to be, which is under whichever heading was written last. Naming the category
 * on the button makes placement independent of when it is added, which is the
 * only way progressive controls can stay organised.
 *
 * Identical signature in the iframe demo and the SDK demo on purpose. Moving a
 * page between the two should be a change of transport, not a rewrite of the
 * interface code.
 */
const e3dsSdkCategories = new Map();

function e3dsSdkCategorySection(panel, category) {
    if (!category) return panel;
    /* [E3DS-PANEL-TIDY] A cached section that has been pruned is no longer in
       the document; returning it would append controls to nothing. */
    if (e3dsSdkCategories.has(category)) {
        const existing = e3dsSdkCategories.get(category);
        if (existing && existing.isConnected) return existing;
        e3dsSdkCategories.delete(category);
    }

    const heading = document.createElement("div");
    heading.className = "demo-group-label";
    heading.textContent = category;

    const section = document.createElement("div");
    section.className = "demo-category";

    panel.appendChild(heading);
    panel.appendChild(section);
    /* [E3DS-PANEL-TIDY] Kept on the section so an empty group can take its
       heading with it, without guessing from document order. */
    section._e3dsHeading = heading;
    e3dsSdkCategories.set(category, section);
    return section;
}

/**
 * @param {string}   label      what the button says
 * @param {function} onClick    what it does
 * @param {string}   [category] the group it belongs under; created if new
 * @param {string}   [needs]    "channel" (default) or "always" - see the rebuild note
 */
/* [E3DS-ARG-SLIP] One string, two meanings - so guess the one that was meant.
 *
 * The signature is (label, onClick, category, needs) and BOTH trailing
 * arguments are optional strings. Passing a single one therefore lands in
 * `category`, silently. That is not a hypothetical: it happened three separate
 * times in this file - Terminate stream, Screenshot and Connection settings all
 * wrote `"session"` or `"always"` meaning the dependency, and each one instead
 * invented a group heading named after a lifetime. The visible result was
 * SESSION appearing twice with controls under the wrong one, an empty ALWAYS
 * heading, and buttons that outlived the session they depended on because
 * `needs` had been left undefined.
 *
 * "channel", "session", "always" and "video" are never sensible group names, so
 * seeing one in the category slot with nothing after it is unambiguous. Shift
 * it, and say so - quietly correcting without a word would leave the next
 * reader believing the call site says what they meant. */
const E3DS_LIFETIMES = ["channel", "session", "always", "video"];

function e3dsFixArgSlip(where, label, category, needs) {
    if (needs === undefined && E3DS_LIFETIMES.indexOf(category) >= 0) {
        console.warn("[E3DS] " + where + '("' + label + '", ..., "' + category +
            '") - "' + category + '" is a dependency, not a group. Treating it as ' +
            'the dependency and leaving the control ungrouped. Pass (category, needs).');
        return { category: undefined, needs: category };
    }
    return { category: category, needs: needs };
}

function addDemoButton(label, onClick, category, needs) {
    ({ category, needs } = e3dsFixArgSlip("addDemoButton", label, category, needs));
    // Created once, then reused for every later button.
    let buttonPanel = document.getElementById("demoButtonPanel");
    if (!buttonPanel) {
        buttonPanel = document.createElement("div");
        buttonPanel.id = "demoButtonPanel";

        /* ON THE PAGE, NOT INSIDE THE PLAYER.
         *
         * This used to be appended into the SDK's own "controls" element, which
         * made the demo buttons part of the player's interface. Two things
         * followed, and both bit:
         *
         *   - if "controls" had not been built yet, addDemoButton gave up with a
         *     console warning and the button never appeared at all. Whether the
         *     demo had buttons depended on load order.
         *   - anything the player did to its own controls - rebuilding them,
         *     hiding them, restyling them - happened to this panel too.
         *
         * On <body> it is independent: it exists from the moment this script
         * runs, and nothing the player does to its interface reaches it.
         */
        document.body.appendChild(buttonPanel);
        makePanelDraggable(buttonPanel);
    }

    const button = document.createElement("button");
    button.className = "demo-button";
    button.textContent = label;

    /* [E3DS-DEMO-NEEDS] What this button depends on, so it can be removed when
     * that goes away. A button that cannot work is worse than one that is not
     * there: people press it, nothing happens, and they blame the SDK.
     *
     *   channel - talks to Unreal over the data channel. Dead the moment the
     *             channel closes: resolution, quality, the stat overlays,
     *             character and skin.
     *   session - needs a live session but not the channel. Terminate.
     *   always  - works with no session at all. Restart, which fetches a fresh
     *             token and starts a new one - the recovery path, so it is the
     *             one thing that must survive. */
    button.dataset.needs = needs || "channel";

    // NOTE, because this is the single easiest mistake to make here:
    // pass a FUNCTION, never the RESULT of calling one.
    //
    //   addDemoButton("HD", () => e3ds_controller.setQualityPoint(1));  correct
    //   addDemoButton("HD", e3ds_controller.setQualityPoint(1));        wrong
    //
    // The second form runs setQualityPoint immediately as the page builds the
    // button, and then assigns its return value (undefined) as the click
    // handler - so the effect happens once, at the wrong moment, and the button
    // does nothing forever after. This demo had exactly that bug.
    button.onclick = onClick;

    e3dsSdkCategorySection(buttonPanel, category).appendChild(button);

    /* RETURNED, so a caller can mark the button it just made.
     *
     * This returned nothing, and addConnectionSettingsButton() was written
     * around the assumption that it did:
     *
     *     const btn = addDemoButton("Connection settings", ...);
     *     if (btn) { btn.id = ...; btn.classList.add("demo-persistent"); }
     *
     * `btn` was undefined, so that block never ran, and two things followed
     * silently. The button never got .demo-persistent, so buildDemoControls()
     * swept it away the moment the data channel opened - the one control that
     * exists for when a stream will NOT start disappeared as soon as one did,
     * and nothing re-added it. And it never got its id, so the guard at the top
     * of addConnectionSettingsButton() could not see it had already been made,
     * which would duplicate it on a second call.
     *
     * Reported as "connection panel gone". */
    return button;
}

/**
 * Build the demo's control panel.
 *
 * Called from onDataChannelOpen. Each button demonstrates one SDK call - and
 * they arrive in two waves, because they become useful at two different
 * moments. See the comment at the top of the function body.
 */
function buildDemoControls() {
    /* START FROM EMPTY. This runs from onDataChannelOpen, which fires on every
     * connection - so it runs again after each restart or reconnect, not only
     * once at startup. Appending to whatever is already there gave a second
     * full set of buttons per restart, then a third.
     *
     * It was invisible until the panel moved out of the player's "controls"
     * element: the player rebuilds those on reconnect, which happened to wipe
     * the buttons first. The duplication was always here - it was being cleaned
     * up by accident.
     *
     * Building into a clean panel makes this safe to call as many times as the
     * stream reconnects, which is the only sane contract for something wired to
     * a connection event.
     */
    const existing = document.getElementById("demoButtonPanel");
    if (existing) {
        /* REMOVE THE BUTTONS, NOT EVERY CHILD.
         *
         * This used to be replaceChildren(), which also destroyed the drag
         * handle - and with it the pointer listeners bound to that element.
         * Re-creating the handle afterwards put the bar back on screen but
         * attached nothing to it, because makePanelDraggable() only runs once,
         * when the panel is first built. So the panel was draggable until the
         * first reconnect and then silently was not: the handle looked right
         * and did nothing.
         *
         * Removing only .demo-button gives the same protection against
         * duplicate buttons and leaves the handle, and its listeners, alone. */
        /* [E3DS-DEMO-PERSISTENT] ...and not the persistent ones either.
         *
         * Connection settings is added at page load rather than here, so
         * sweeping every .demo-button would delete it on the first data channel
         * and again on every reconnect. */
        existing.querySelectorAll("[data-needs]:not(.demo-persistent)")
            .forEach(function (b) { b.remove(); });
        makePanelDraggable(existing);
    }


    /* ─────────────────────────────────────────────────────────────────────
     * BUTTONS APPEAR IN TWO STAGES, ON PURPOSE.
     *
     * A button that is visible but does nothing is worse than one that is not
     * there yet: people press it, nothing happens, and they conclude the SDK is
     * broken. So each button appears only once the thing it needs is actually
     * ready, and says so in the console as it arrives.
     *
     *   STAGE 1 - data channel open (now).  Anything that SENDS A MESSAGE to
     *             your Unreal app: character, skin, and the console overlays.
     *             The channel is the only thing these need.
     *
     *   STAGE 2 - video playing.  Session control and picture settings.
     *             Restarting or terminating a session that has not started
     *             does nothing; so does setting the quality or resolution of a
     *             picture that is not being rendered yet.
     *
     * Watch them appear in two groups the next time you load this page - that
     * staging is the point, not a side effect.
     * ───────────────────────────────────────────────────────────────────── */

    console.log("[E3DS] Data channel is open - adding the buttons that send " +
        "messages to your app (character, skin, console overlays).");

    /* ── Talking to your app - APP-SPECIFIC ────────────────────────────── */

    /* [E3DS-APP-CONTROLS] NOT GENERIC: { Character: … } and { Skin: … } are what the sample app listens for, a colour
     * name is what the car configurator listens for. So the controls come from E3DS_APP_CONTROLS in demo-ui-tools.js
     * (the same table as the iframe demo), per app; an app that is not listed gets "No app controls available for this
     * app." Then the message box they write into, which works with any app. */
    e3dsBuildAppControls(STREAMING_CONFIG.application.appName);

    /* ── Unreal console commands (useful while developing) ─────────────── */

    // These draw overlays on the video itself. They travel over the data
    // channel, so they are ready now - the overlay simply is not visible until
    // there are frames to draw it on.
    addDemoButton("Show FPS", () => sdkCall("sendConsoleCommandToUE", "stat fps"), "Diagnostics", "channel");

    addDemoButton("Show streaming graphs", () => {
        sdkCall("sendConsoleCommandToUE", "stat pixelstreaminggraphs");
        sdkCall("sendConsoleCommandToUE", "stat pixelstreaming2graphs");
    }, "Diagnostics", "channel");

    /* Any Unreal console command, typed - the whole console, not just the two shortcuts above. */
    addDemoTextInput("Unreal console command", {
        placeholder: "type a console command",
        buttonLabel: "Send",
        title: "Any Unreal console command, for example: stat fps, stat unit, r.ScreenPercentage 50"
    }, (command) => sdkCall("sendConsoleCommandToUE", command), "Diagnostics", "channel");

    /* Stage 2 arrives on its own, whenever the video does. */
    whenVideoIsPlaying(addVideoStageButtons);
}

/**
 * The buttons that only make sense once frames are arriving.
 */
function addVideoStageButtons() {
    console.log("[E3DS] Video is playing - adding session control (restart, " +
        "terminate) and picture settings (quality, resolution). These were " +
        "held back because they do nothing before there is a stream.");

    /* Same groups, same order, same labels as the iframe demo: Picture, Sound, Input, Window, then Restart and
     * Terminate under Session. Every button goes through sdkCall, so the call it makes is written into the Log. */

    /* ── Picture ── [E3DS-QUALITY-PRESET] the four named levels, never a raw number: a level is the portable unit,
     * resolved by the platform to whichever scale the running plugin uses. */
    addDemoButton("Quality: Low", () => sdkCall("setVideoDetailLevel", "low"), "Picture", "channel");
    addDemoButton("Quality: Medium", () => sdkCall("setVideoDetailLevel", "medium"), "Picture", "channel");
    addDemoButton("Quality: High", () => sdkCall("setVideoDetailLevel", "high"), "Picture", "channel");
    addDemoButton("Quality: Ultra", () => sdkCall("setVideoDetailLevel", "ultra"), "Picture", "channel");
    addDemoButton("1920 x 1080", () => sdkCall("setResolution", 1920, 1080), "Picture", "channel");
    addDemoButton("800 x 600", () => sdkCall("setResolution", 800, 600), "Picture", "channel");
    addDemoTextInput("Custom resolution", { placeholder: "width x height, e.g. 1280 x 720", buttonLabel: "Set" },
        (value) => {
            const n = value.match(/\d+/g);
            if (!n || n.length < 2) { e3dsLogAppResponse("needs two numbers, for example 1280 x 720", "err"); return; }
            sdkCall("setResolution", Number(n[0]), Number(n[1]));
        }, "Picture", "channel");
    addDemoButton("Match window resolution", () => sdkCall("useViewportResolution"), "Picture", "channel");

    /* ── Sound ── [E3DS-VOLUME-ONE-PIPELINE] the same setVolume an iframe page and Unreal reach. "session": it sets
     * the local audio element, so it keeps working if the data channel closes. The stream begins muted; moving the
     * slider is a real user gesture, which is what lets setVolume unmute it. */
    addDemoSlider("Volume", { min: 0, max: 1, step: 0.01, value: 1 },
        (v) => sdkCall("setVolume", v), "session", "Sound");

    /* ── Input ── how the mouse drives the app, and whether touches reach it (off is what you want when your own
     * buttons sit over the stream on a phone). */
    addDemoButton("Mouse: Hovering", () => sdkCall("switchMouseControlSchemeTo", "HoveringMouse"), "Input", "channel");
    addDemoButton("Mouse: Locked", () => sdkCall("switchMouseControlSchemeTo", "LockedMouse"), "Input", "channel");
    let e3dsTouchOn = true;
    const touchButton = addDemoButton("Touch input: on", () => {
        e3dsTouchOn = !e3dsTouchOn;
        sdkCall("setTouchInputEnabled", e3dsTouchOn);
        touchButton.textContent = "Touch input: " + (e3dsTouchOn ? "on" : "off");
    }, "Input", "channel");

    /* ── Window ── Fullscreen must be a real click (browsers only grant it from a user gesture). Screenshot returns
     * the picture as well as saving it - a real integration may want to upload or show it instead. */
    addDemoButton("Fullscreen", () => sdkCall("toggleFullscreen"), "Window", "session");
    addDemoButton("Screenshot", () => {
        const shot = sdkCall("captureScreenShot");
        if (shot && !shot.ok) e3dsLogAppResponse("Screenshot failed: " + shot.error, "err");
    }, "Window", "session");

    /* ── Session ── Restart works with no session at all (it fetches a fresh token), so it is "always". Terminate
     * also tidies the panel: onSessionEnding does not fire for a terminate we asked for. */
    addDemoButton("Restart stream", () => { e3dsLogAppResponse("restartStream() - terminate, then a new token and session", "out"); restartStream(); }, "Session", "always");
    addDemoButton("Terminate stream", function () {
        sdkCall("terminate");
        removeDemoButtonsNeeding("session");
    }, "Session", "session");
}

/**
 * Calls back once the stream is actually showing frames.
 *
 * There is no onVideoStarted callback in the SDK, so this watches the video
 * element directly. Two routes, because either can be the one that fires:
 * the 'playing' event if we attach before playback begins, and a poll for the
 * case where video was already running by the time we got here - which is
 * exactly what happens on a reconnect.
 *
 * Idempotent: buildDemoControls() runs again on every reconnect, so any watcher
 * from the previous connection is cancelled first. Without that, a page that
 * reconnects three times would add the second group three times.
 */
/* Prefixed, because a top-level `let` in a classic script is a GLOBAL binding.
 *
 * Not a window property - top-level let/const go into the global lexical scope
 * rather than onto window - but global all the same, and shared with every other
 * classic script the page loads. Two scripts both declaring `let videoWatchEl`
 * do not silently overwrite each other: that is a redeclaration SyntaxError, and
 * it stops the SECOND script parsing entirely.
 *
 * This folder is meant to be copied into someone else's page, so names this
 * generic are a real hazard: the symptom would be the demo panel never
 * appearing, with the error pointing at our file. */
let e3dsVideoWatchPoll = null;
let e3dsVideoWatchEl = null;
let e3dsVideoWatchFn = null;

function whenVideoIsPlaying(callback) {
    if (e3dsVideoWatchPoll) { clearInterval(e3dsVideoWatchPoll); e3dsVideoWatchPoll = null; }
    if (e3dsVideoWatchEl && e3dsVideoWatchFn) {
        e3dsVideoWatchEl.removeEventListener("playing", e3dsVideoWatchFn);
        e3dsVideoWatchEl = null; e3dsVideoWatchFn = null;
    }

    let fired = false;
    const done = () => {
        if (fired) return;
        fired = true;
        if (e3dsVideoWatchPoll) { clearInterval(e3dsVideoWatchPoll); e3dsVideoWatchPoll = null; }
        if (e3dsVideoWatchEl && e3dsVideoWatchFn) {
            e3dsVideoWatchEl.removeEventListener("playing", e3dsVideoWatchFn);
            /* Released here too, matching the cancel path above, which always
               did. Without it a detached <video> stayed referenced until the
               next call, and that next call then detached a listener that was
               already gone - two paths that should behave identically not
               doing so. */
            e3dsVideoWatchEl = null;
            e3dsVideoWatchFn = null;
        }
        callback();
    };

    const video = () => document.getElementById("streamingVideo")
        || document.querySelector("#playerUI video");

    const isPlaying = (v) => v && v.readyState >= 2 && !v.paused;

    const v = video();
    if (isPlaying(v)) { done(); return; }

    if (v) {
        e3dsVideoWatchEl = v;
        e3dsVideoWatchFn = done;
        v.addEventListener("playing", done);
    }

    /* The element may not exist yet, or may have started before we looked. */
    e3dsVideoWatchPoll = setInterval(() => {
        const cur = video();
        if (cur && cur !== e3dsVideoWatchEl) {
            if (e3dsVideoWatchEl && e3dsVideoWatchFn) e3dsVideoWatchEl.removeEventListener("playing", e3dsVideoWatchFn);
            e3dsVideoWatchEl = cur; e3dsVideoWatchFn = done;
            cur.addEventListener("playing", done);
        }
        if (isPlaying(cur)) done();
    }, 400);
}


/* ── [E3DS-DEMO-DRAG] Moving the panel ─────────────────────────────────────
 *
 * The panel is fixed to the top right, and there it covers whatever is in the
 * top right of the app. Rather than pick a corner that is wrong for a different
 * app, let it be moved.
 *
 * Pointer events, not mouse events: one code path covers mouse, touch and pen.
 * The panel is captured on pointerdown so a fast drag that leaves the handle
 * keeps moving instead of stopping dead.
 */

function addDragHandle(panel) {
    if (panel.querySelector("#demoDragHandle")) return;
    const handle = document.createElement("div");
    handle.id = "demoDragHandle";
    handle.title = "Drag to move this panel, tap to collapse it";
    handle.innerHTML = "<span></span><span></span><span></span>"
        + '<b id="demoPanelCaret" aria-hidden="true">&#9662;</b>';
    panel.prepend(handle);
    return handle;
}

function makePanelDraggable(panel) {
    /* Idempotent: called when the panel is created and again on every rebuild.
     * addDragHandle returns undefined when the handle is already there, which
     * is the normal case on a rebuild - the listeners are still attached, so
     * there is nothing to redo. */
    const handle = addDragHandle(panel);
    if (!handle) return;

    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    let dragging = false;
    /* Travelled far enough to be a drag rather than a tap. */
    let moved = false;
    /* Only a tap that STARTED on the handle collapses the panel. A tap on a
     * group heading is just a tap on dead space. */
    let fromHandle = false;

    /* [E3DS-DRAG-ANYWHERE] Anything that is not a control can start a drag.
     *
     * The handle used to be the only grab point - a thin bar on a panel that
     * fills most of a phone screen. Group headings, the gaps between buttons and
     * the panel's padding are all dead space, and any of them can move it now.
     *
     * A CONTROL NEVER STARTS A DRAG: pointerdown on a button or the volume
     * slider is left alone, so it still clicks and still slides. */
    const isControl = (t) =>
        !!(t && typeof t.closest === "function" && t.closest("button, input, select, textarea, a, label"));

    /* ONE set of listeners, on the panel only. The handle is inside the panel,
     * so its events bubble here - registering on both would run every handler
     * twice, and a double collapse toggle looks exactly like a dead button. */
    panel.addEventListener("pointerdown", (e) => {
        const onHandle = e.target === handle || (handle.contains && handle.contains(e.target));
        if (!onHandle && isControl(e.target)) return;

        fromHandle = onHandle;
        moved = false;

        const r = panel.getBoundingClientRect();

        /* Switch from the CSS right/top anchoring to explicit left/top the
         * moment a drag starts. Setting left while `right` is still applied
         * would stretch the panel between the two edges rather than move it. */
        panel.style.left = r.left + "px";
        panel.style.top = r.top + "px";
        panel.style.right = "auto";

        startX = e.clientX;
        startY = e.clientY;
        startLeft = r.left;
        startTop = r.top;
        dragging = true;

        handle.classList.add("dragging");
        try { panel.setPointerCapture(e.pointerId); } catch (err) { }
    });

    panel.addEventListener("pointermove", (e) => {
        if (!dragging) return;

        /* Past this distance it is a drag, not a tap. A few pixels of travel is
           normal for a finger that meant to tap. */
        if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) moved = true;
        if (!moved) return;

        const r = panel.getBoundingClientRect();

        /* Keep it on screen. Dragged fully off, it becomes unreachable with no
         * way back short of a reload. A 40px margin means some of it is always
         * grabbable. */
        const margin = 40;
        const maxLeft = window.innerWidth - margin;
        const maxTop = window.innerHeight - margin;

        let left = startLeft + (e.clientX - startX);
        let top = startTop + (e.clientY - startY);

        left = Math.max(margin - r.width, Math.min(left, maxLeft));
        top = Math.max(0, Math.min(top, maxTop));

        panel.style.left = left + "px";
        panel.style.top = top + "px";
        e.preventDefault();
    });

    const end = (e) => {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove("dragging");
        try { panel.releasePointerCapture(e.pointerId); } catch (err) { }

        /* `dragging` is set on pointerdown, so it is always true here - travel
         * is what separates a tap from a drag, and `moved` records that. */
        if (moved || !fromHandle) return;

        panel.classList.toggle("collapsed");
        const caret = handle.querySelector("#demoPanelCaret");
        if (caret) {
            caret.innerHTML = panel.classList.contains("collapsed") ? "&#9656;" : "&#9662;";
        }
    };
    panel.addEventListener("pointerup", end);
    panel.addEventListener("pointercancel", end);

    /* [E3DS-DRAG-ANYWHERE] Swallow the click a drag would otherwise deliver.
     *
     * A drag that ends over a button would fire that button on release - so
     * repositioning the panel could terminate the session by accident. Capture
     * phase, so this runs before the button's own handler, and only when the
     * pointer actually travelled. */
    panel.addEventListener("click", (e) => {
        if (!moved) return;
        e.stopPropagation();
        e.preventDefault();
        moved = false;
    }, true);

    /* If the window shrinks below where the panel was left, pull it back into
     * view rather than leaving it stranded off the edge. */
    window.addEventListener("resize", () => {
        if (panel.style.left === "") return;
        const r = panel.getBoundingClientRect();
        const margin = 40;
        panel.style.left = Math.max(margin - r.width,
            Math.min(parseFloat(panel.style.left) || 0, window.innerWidth - margin)) + "px";
        panel.style.top = Math.max(0,
            Math.min(parseFloat(panel.style.top) || 0, window.innerHeight - margin)) + "px";
    });
}


/**
 * Remove the buttons that depend on something which has just gone away.
 *
 * Called from onDataChannelClose and onSessionEnding in
 * sdk-callbacks.js. Safe to call repeatedly and safe to call when the panel
 * does not exist yet.
 */
/* [E3DS-DEMO-PERSISTENT] The one control that exists before there is a stream.
 *
 * Every other button is built by buildDemoControls(), which runs from
 * onDataChannelOpen - so the whole panel appears only once a stream is already
 * working. That is right for buttons that talk to the app, and exactly wrong
 * for this one: connection settings are what you need when the stream will NOT
 * start, which is precisely when nothing has called buildDemoControls().
 *
 * Tagging it "always" was not enough on its own. `needs` decides when a button
 * is REMOVED; it says nothing about when the panel is first built.
 *
 * So it is added at page load, marked .demo-persistent, and the rebuild step
 * skips that class - otherwise the first data channel, and every reconnect
 * after it, would sweep it away with the rest.
 */
function addConnectionSettingsButton() {
    if (document.getElementById("e3dsConnSettingsBtn")) return;

    const btn = addDemoButton("Connection settings", () => {
        if (typeof e3dsOpenConnectionSetup !== "function") {
            alert("demo-ui-connection-setup.js is not loaded on this page.");
            return;
        }
        /* [E3DS-DEMO-PHONE] On a phone the controls are a sheet over the bottom of the screen - close it, or it
         * sits over the settings window's Cancel and Save. */
        if (typeof e3dsPhoneCloseAll === "function") e3dsPhoneCloseAll();
        e3dsOpenConnectionSetup();
        /* [E3DS-PANEL-TIDY] "Session", "always" - group, then dependency. This
         * passed "always" alone, which lands in the CATEGORY position: it drew
         * a heading called ALWAYS and left the dependency defaulting, so the one
         * control meant to survive every teardown was grouped by its own
         * lifetime instead of by what it does. */
    }, "Session", "always");

    if (btn) {
        btn.id = "e3dsConnSettingsBtn";
        btn.classList.add("demo-persistent");
    }
}

/* Both paths covered: this file may be loaded with `defer` (document still
 * parsing) or injected later (already interactive), and the button has to exist
 * in either case. */
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addConnectionSettingsButton);
} else {
    addConnectionSettingsButton();
}

function removeDemoButtonsNeeding(what) {
    const panel = document.getElementById("demoButtonPanel");
    if (!panel) return;

    /* [E3DS-PANEL-TIDY] ANY control, not only .demo-button.
     *
     * This selector was '.demo-button[data-needs=...]', and the volume slider is
     * not a .demo-button - it is a row. So it carried data-needs="session"
     * faithfully and was never once removed by it. Reported from a kicked
     * session: the stream was gone and the panel still offered Volume, with a
     * slider that moved and did nothing.
     *
     * Matching on the attribute instead of the class means anything that
     * declares a dependency is honoured, including row types added later - the
     * next one would otherwise repeat this silently. */
    const gone = panel.querySelectorAll('[data-needs="' + what + '"]');
    if (!gone.length) { e3dsPruneEmptyCategories(panel); return; }

    gone.forEach(function (b) { b.remove(); });
    console.log("[E3DS] Removed " + gone.length + " control(s) that needed the " +
        what + " - it is gone, so they would have done nothing.");

    e3dsPruneEmptyCategories(panel);
}

/* [E3DS-PANEL-TIDY] A heading with nothing under it is worse than no heading.
 *
 * Removing controls left their group headings behind, so a kicked session
 * showed "SESSION" with nothing in it - and, because two groups existed whose
 * names differed only in case, "SESSION" twice with the buttons under the wrong
 * one. A reader cannot tell an empty group from a broken panel.
 *
 * The heading is stored on the section rather than found by walking siblings,
 * so this cannot delete the wrong element when the panel is rearranged. */
function e3dsPruneEmptyCategories(panel) {
    const sections = panel.querySelectorAll(".demo-category");
    sections.forEach(function (section) {
        if (section.querySelector("[data-needs], .demo-button, .demo-row")) return;
        if (section.children.length > 0) return;
        const heading = section._e3dsHeading;
        if (heading && heading.remove) heading.remove();
        section.remove();
    });
}


/* [E3DS-DEMO-PHONE] The panel stays out of the way on a phone - same layout as the iframe demo.
 *
 * On a phone the panel opened over most of the stream. Here it starts closed; a small "Web SDK controls" button at
 * the top right opens it as a sheet along the bottom, and tapping the button again closes it (styles: css/style.css).
 *
 * "A phone" = a narrow window OR a touch screen. Width alone misses phones held sideways and in-app browsers that
 * lay the page out at desktop width. A mouse on a wide window keeps the desktop layout. */
const E3DS_PHONE = window.matchMedia("(max-width: 820px), (pointer: coarse)");

const E3DS_PHONE_PANELS = ["demoButtonPanel", "appResponsePanel"];

function e3dsPhoneCloseAll(except) {
    E3DS_PHONE_PANELS.forEach((id) => {
        if (id === except) return;
        const el = document.getElementById(id);
        if (el) el.classList.remove("e3ds-phone-open");
        const b = document.querySelector('#e3dsPhoneBar button[data-panel="' + id + '"]');
        if (b) b.classList.remove("on");
    });
}

function e3dsPhoneToggle(id) {
    const el = id === "appResponsePanel" ? e3dsGetLogPanel() : document.getElementById(id);
    if (!el) return;
    const opening = !el.classList.contains("e3ds-phone-open");
    e3dsPhoneCloseAll(id);
    el.classList.toggle("e3ds-phone-open", opening);
    el.classList.remove("collapsed");
    const b = document.querySelector('#e3dsPhoneBar button[data-panel="' + id + '"]');
    if (b) b.classList.toggle("on", opening);
}

function e3dsPhoneLayout() {
    if (!E3DS_PHONE.matches || document.getElementById("e3dsPhoneBar")) return;
    document.body.classList.add("e3ds-phone");

    const bar = document.createElement("div");
    bar.id = "e3dsPhoneBar";
    [["Web SDK controls", "demoButtonPanel"], ["Log", "appResponsePanel"]].forEach(([label, id]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.dataset.panel = id;
        b.addEventListener("click", () => e3dsPhoneToggle(id));
        bar.appendChild(b);
    });
    document.body.appendChild(bar);

    e3dsGetLogPanel();
    e3dsPhoneSheetResize("demoButtonPanel", "controls");
    e3dsPhoneSheetResize("appResponsePanel", "log");
}

/* On a phone the controls and the Log are sheets along the bottom. A sheet's top bar resizes it instead of moving
 * it: drag up for more of the panel, down for more stream. Touch browsers show no resize corner, so this is the only
 * way to size it with a finger. Same as the iframe demo. */
function e3dsPhoneSheetResize(panelId, what) {
    const panel = panelId === "appResponsePanel" ? e3dsGetLogPanel() : e3dsSdkPanel();
    const handle = panel && panel.querySelector("#demoDragHandle");
    if (!handle) return;
    handle.title = "Drag up or down to resize the " + what;
    let startY = 0, startH = 0, sizing = false;
    handle.addEventListener("pointerdown", (e) => {
        startY = e.clientY;
        startH = panel.getBoundingClientRect().height;
        sizing = true;
    });
    /* On the WINDOW, not the handle: makePanelDraggable captures the pointer on the whole panel, so the handle itself
     * never sees the moves. */
    window.addEventListener("pointermove", (e) => {
        if (!sizing) return;
        const h = Math.max(120, Math.min(startH + (startY - e.clientY), window.innerHeight * 0.85));
        panel.style.setProperty("height", Math.round(h) + "px", "important");
        panel.style.setProperty("max-height", "85vh", "important");
    }, true);
    const stop = () => { sizing = false; };
    window.addEventListener("pointerup", stop, true);
    window.addEventListener("pointercancel", stop, true);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", e3dsPhoneLayout);
} else {
    e3dsPhoneLayout();
}
