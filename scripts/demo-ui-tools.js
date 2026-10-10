/**
 * demo-ui-tools.js — the pieces the demo panel is built from, shared with the iframe demo.
 *
 * Same names and the same behaviour as the iframe demo's panel, so the two demos look and work alike and a page can
 * move from one to the other by changing the transport, not the interface:
 *
 *   addDemoTextInput / addDemoSelect   a box or a dropdown on the panel
 *   e3dsLogAppResponse                 the Log window: every call this page makes, everything that comes back
 *   sdkCall                            call e3ds_controller.<name>(...) AND write that call into the Log
 *   E3DS_APP_CONTROLS                  per-app controls ("Your app"), and the message box that shows what they send
 *
 * Loaded before sdk-callbacks.js and demo-ui-controls.js.
 */

/* The panel, created on first use (the same way addDemoButton creates it). */
function e3dsSdkPanel() {
    let panel = document.getElementById("demoButtonPanel");
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "demoButtonPanel";
        document.body.appendChild(panel);
        if (typeof makePanelDraggable === "function") makePanelDraggable(panel);
    }
    return panel;
}

/* ── A box with its button ([E3DS-DEMO-TEXT-INPUT]) ─────────────────────────────────────────────────────────────
 * The button is usable exactly when there is something to send: greyed out while the box is empty, active the moment
 * it holds text - typed, pasted, or written in by an app control (which calls field.e3dsRefresh()). After a send the
 * button reads "Sent" for a moment, and the text stays, so sending a variation is an edit rather than a retype.
 *   opts: { placeholder, buttonLabel, title, value, multiline } */
function addDemoTextInput(label, opts, onSubmit, category, needs) {
    const options = opts || {};
    const section = e3dsSdkCategorySection(e3dsSdkPanel(), category);

    const row = document.createElement("div");
    row.className = "demo-text-row" + (options.multiline ? " demo-text-multiline" : "");
    row.dataset.needs = needs || "channel";

    const field = document.createElement(options.multiline ? "textarea" : "input");
    if (options.multiline) field.rows = 3; else field.type = "text";
    field.className = "demo-text-input";
    field.placeholder = options.placeholder || "";
    field.title = options.title || label;
    field.value = options.value || "";
    field.addEventListener("mousedown", (e) => e.stopPropagation());   // a click in the box is not a panel drag
    field.addEventListener("pointerdown", (e) => e.stopPropagation());
    field.addEventListener("keydown", (e) => {
        e.stopPropagation();                                           // typing must not reach the stream
        if (e.key === "Enter" && (!options.multiline || e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
    });

    const go = document.createElement("button");
    go.className = "demo-text-send";
    go.textContent = options.buttonLabel || "Send";
    go.addEventListener("pointerdown", (e) => e.stopPropagation());
    go.addEventListener("click", () => send());

    function send() {
        const value = field.value.trim();
        if (!value) return;
        onSubmit(value);
        const labelText = options.buttonLabel || "Send";
        go.textContent = "Sent ✓";
        clearTimeout(go.e3dsSentTimer);
        go.e3dsSentTimer = setTimeout(() => { go.textContent = labelText; }, 900);
    }

    const refresh = () => { go.disabled = !field.value.trim(); };
    field.addEventListener("input", refresh);
    field.e3dsRefresh = refresh;
    refresh();

    row.appendChild(field);
    row.appendChild(go);
    section.appendChild(row);
    return field;
}

/* ── A dropdown ([E3DS-DEMO-SELECT]) - the placeholder has an EMPTY value, so nothing is sent until a real choice. */
function addDemoSelect(label, opts, onChange, category, needs) {
    const options = opts || {};
    const section = e3dsSdkCategorySection(e3dsSdkPanel(), category);

    const row = document.createElement("div");
    row.className = "demo-select-row";
    row.dataset.needs = needs || "channel";

    const caption = document.createElement("div");
    caption.className = "demo-select-label";
    caption.textContent = label;

    const select = document.createElement("select");
    select.className = "demo-select";
    select.title = label;
    select.addEventListener("pointerdown", (e) => e.stopPropagation());
    select.addEventListener("change", () => onChange(select.value, select));

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = options.placeholder || "Select";
    select.appendChild(placeholder);

    row.appendChild(caption);
    row.appendChild(select);
    section.appendChild(row);
    return select;
}

/* ── The Log window ([E3DS-LOG]) ────────────────────────────────────────────────────────────────────────────────
 * Every SDK call this page makes (→) and everything the stream reports back (←), newest first, so the API can be
 * learned by pressing a button and reading what it did. Bounded, so a chatty app cannot grow the page forever. */
const E3DS_LOG_MAX = 200;
const E3DS_LOG_MARK = { out: "→", in: "←", err: "✗", note: "·" };

function e3dsGetLogPanel() {
    let panel = document.getElementById("appResponsePanel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "appResponsePanel";

    const head = document.createElement("div");
    head.className = "app-response-head";
    const title = document.createElement("div");
    title.className = "demo-group-label";
    title.textContent = "Log";
    const clear = document.createElement("button");
    clear.className = "app-response-clear";
    clear.textContent = "Clear";
    clear.addEventListener("pointerdown", (e) => e.stopPropagation());
    clear.addEventListener("click", () => {
        const list = document.getElementById("appResponseList");
        if (list) list.innerHTML = '<div class="app-response-empty">Cleared.</div>';
    });
    head.appendChild(title);
    head.appendChild(clear);

    const list = document.createElement("div");
    list.id = "appResponseList";
    list.innerHTML = '<div class="app-response-empty">Nothing yet. Every SDK call this page makes, and everything '
        + "the stream reports back, appears here newest first.</div>";

    panel.appendChild(head);
    panel.appendChild(list);
    document.body.appendChild(panel);
    if (typeof makePanelDraggable === "function") makePanelDraggable(panel);
    return panel;
}

/**
 * Put one line in the Log.
 * @param {*}      obj    what to show - an object is pretty-printed
 * @param {string} [kind] out | in | err | note (default in)
 * @param {string} [label] a few words beside the time
 */
function e3dsLogAppResponse(obj, kind, label) {
    try {
        e3dsGetLogPanel();
        const list = document.getElementById("appResponseList");
        const empty = list.querySelector(".app-response-empty");
        if (empty) empty.remove();

        const entry = document.createElement("div");
        entry.className = "app-response-entry";
        entry.dataset.kind = kind || "in";
        const when = document.createElement("div");
        when.className = "app-response-time";
        when.textContent = E3DS_LOG_MARK[kind || "in"] + " " + new Date().toLocaleTimeString() + (label ? "  " + label : "");
        entry.appendChild(when);
        const text = (obj === undefined || obj === null) ? "" : (typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
        if (text) {
            const body = document.createElement("pre");
            body.className = "app-response-body";
            body.textContent = text;
            entry.appendChild(body);
        }
        list.prepend(entry);
        while (list.children.length > E3DS_LOG_MAX) list.removeChild(list.lastChild);
    } catch (e) {
        console.error("[E3DS-LOG] could not write to the Log:", e);
    }
}

/**
 * Call an SDK function and write the call into the Log first - the one line to copy is in the Log.
 *     sdkCall("setResolution", 800, 600)   logs  e3ds_controller.setResolution(800, 600)
 */
function sdkCall(name, ...args) {
    e3dsLogAppResponse("e3ds_controller." + name + "(" + args.map((a) => JSON.stringify(a)).join(", ") + ")", "out");
    if (typeof e3ds_controller[name] !== "function") {
        e3dsLogAppResponse("e3ds_controller." + name + " is not in this SDK build", "err");
        return undefined;
    }
    return e3ds_controller[name](...args);
}

/* ── Your app ([E3DS-APP-CONTROLS]) ─────────────────────────────────────────────────────────────────────────────
 * Controls that only one app understands, per app name. An entry is a button - [label, message] - or a dropdown -
 * { label, placeholder, options: [[label, message], ...] }; the message is what sendToUnreal sends.
 * Any app not listed gets "No app controls available for this app." The same table as the iframe demo. */
const E3DS_APP_CONTROLS = {
    /* The car configurator: a colour name, as a plain string. */
    "AutomotiveConfigurator": [
        { label: "Car colour", placeholder: "Select a colour",
          options: [["Red", "red"], ["Black", "black"], ["White", "white"], ["Silver", "silver"], ["Blue", "blue"]] },
    ],
    /* Epic's Pixel Streaming sample. */
    "EpicPixelStreamingSample": [
        ["Character: Crunch", { Character: "Crunch" }], ["Character: Aurora", { Character: "Aurora" }],
        ["Skin 1", { Skin: "0" }], ["Skin 2", { Skin: "1" }], ["Skin 3", { Skin: "2" }],
    ],
};

/* The message box. Every app control writes the message it sends into it, so the viewer sees that a button is just a
 * message sent to the build - and can edit it and send a variation. */
let e3dsAppMessageBox = null;
function e3dsSendAppMessage(message) {
    if (e3dsAppMessageBox) { e3dsAppMessageBox.value = JSON.stringify(message); e3dsAppMessageBox.e3dsRefresh(); }
    sdkCall("sendToUnreal", message);
}

/* Builds "Your app" for the app that is streaming: its controls (or the "none" note), then the message box. */
function e3dsBuildAppControls(appName) {
    const mark = (el) => { el.dataset.needs = "channel"; return el; };
    const controls = E3DS_APP_CONTROLS[appName];
    if (!controls) {
        const note = document.createElement("div");
        note.className = "demo-empty-note";
        note.textContent = "No app controls available for this app.";
        e3dsSdkCategorySection(e3dsSdkPanel(), "Your app").appendChild(mark(note));
    } else {
        controls.forEach((control) => {
            if (Array.isArray(control)) {
                const [label, message] = control;
                addDemoButton(label, () => e3dsSendAppMessage(message), "Your app", "channel");
            } else {
                const select = addDemoSelect(control.label, { placeholder: control.placeholder },
                    (value) => { if (value !== "") e3dsSendAppMessage(control.options[Number(value)][1]); },
                    "Your app", "channel");
                control.options.forEach(([label], i) => {
                    const option = document.createElement("option");
                    option.value = String(i);
                    option.textContent = label;
                    select.appendChild(option);
                });
            }
        });
    }
    e3dsAppMessageBox = addDemoTextInput("Message to your app", {
        placeholder: '{ "Character": "Aurora" }',
        buttonLabel: "Send to app",
        multiline: true,
        title: "JSON if it parses, otherwise sent as plain text. Ctrl+Enter sends."
    }, (value) => {
        let payload = value;
        try { payload = JSON.parse(value); }
        catch (e) { console.log("[E3DS] message box: not JSON (" + e.message + ") - sent as plain text"); }
        sdkCall("sendToUnreal", payload);
    }, "Your app", "channel");
}
