/**
 * demo-ui-connection-setup.js — let someone try the demo without editing sdk-config.js.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * sdk-config.js ships with placeholders. Until now, opening this page without
 * editing that file first produced an alert() saying "STREAMING_API_KEY is
 * still the placeholder" and nothing else - a dead end for anyone who just
 * wanted to see the demo work, and especially for anyone opening it from a
 * hosted URL where editing the file is not an option at all.
 *
 * So: if the code has not been filled in, ask in the page instead of refusing.
 * Editing sdk-config.js still works exactly as before and always wins where it is
 * set - this only fills gaps.
 *
 * ── Where the values go ────────────────────────────────────────────────────
 *
 * Into localStorage on the viewer's own browser, and nowhere else. They are
 * never sent anywhere except the same token endpoint sdk-config.js would have used.
 * This is deliberately the same trade-off sdk-config.js already makes and documents:
 * a key in the page is readable by anyone who can open devtools. It is fine for
 * a demo or an internal test, and it is NOT how a production integration should
 * work - there, your own server holds the key and returns only a token. See the
 * warning at the top of sdk-config.js.
 *
 * Because of that, the panel says so on screen rather than burying it here.
 */

/** One place to change if the storage key ever needs versioning. */
const E3DS_SETTINGS_KEY = "e3ds.sdkDemo.settings"   /* NOT renamed with the file: this key is
    * already in people's browsers, and changing it silently loses whatever they
    * saved. The name is stale; the data is not. */;

/** The value sdk-config.js ships with, which means "not filled in". */
const E3DS_API_KEY_PLACEHOLDER = "Your Streaming API Key";

function e3dsLoadSavedConnection() {
    try {
        const raw = localStorage.getItem(E3DS_SETTINGS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        /* Corrupt or blocked storage must not break the page - it just means
         * there is nothing saved, which the panel handles already. */
        return {};
    }
}

function e3dsSaveConnection(settings) {
    try {
        localStorage.setItem(E3DS_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn("Could not save settings (private browsing?): " + e.message);
    }
}

/** True when sdk-config.js has not had a real key pasted into it. */
/* [E3DS-SDK-KEY-SCOPE] Read the IDENTIFIER, not the window property.
 *
 * sdk-config.js declares `const STREAMING_API_KEY = "..."`, and a top-level const in
 * a classic script does NOT become a property of window - it lives in the global
 * lexical environment instead. `var` and `function` do; `const` and `let` never
 * do, in a script or a module.
 *
 * So window.STREAMING_API_KEY was always undefined, this always answered
 * "missing", and the setup panel opened on EVERY load no matter what real key
 * had been pasted into sdk-config.js. Typing the key into the panel was the only
 * thing that worked, because that value goes to window.__e3dsApiKeyOverride,
 * which really is a window property - so localStorage was quietly rescuing a
 * configuration that could never work on its own.
 *
 * FIXED HERE RATHER THAN BY CHANGING sdk-config.js TO `var`. That would work today
 * and fail twice over: `var` is not a window property inside a bundle either,
 * and our own template and README both show `const`, so every integrator who
 * copies our documentation would hit exactly this. Reading the identifier works
 * for const or var, in a script or a bundle, in their file or ours.
 *
 * typeof on a bare identifier is the one form that does not throw when it is
 * undeclared, which keeps this file loadable on its own. window is still
 * consulted as a fallback, so anyone who deliberately set it there is honoured.
 */
function e3dsCurrentApiKey() {
    try {
        if (typeof STREAMING_API_KEY !== "undefined" && STREAMING_API_KEY) {
            return STREAMING_API_KEY;
        }
    } catch (e) { /* not declared in this scope */ }
    return window.STREAMING_API_KEY;
}

function e3dsApiKeyMissing() {
    var key = e3dsCurrentApiKey();
    return !key || key === E3DS_API_KEY_PLACEHOLDER;
}

/**
 * Apply saved values into the live config.
 *
 * CODE WINS. A value typed into the panel is only used where sdk-config.js left a
 * gap, so someone who has filled the file in never has stale localStorage
 * quietly override it - which would be a genuinely confusing bug to chase.
 *
 * The username fills application.userName, which is the only place it lives
 * now. There used to be a second field, clientUserName, that always held the
 * same value; it was removed, so there is one username and one field.
 */
function e3dsApplySavedConnection() {
    const saved = e3dsLoadSavedConnection();
    if (!saved || typeof saved !== "object") return;

    if (saved.apiKey && e3dsApiKeyMissing()) {
        /* STREAMING_API_KEY is a const in sdk-config.js, so it cannot be
         * reassigned. sdk-token.js reads e3dsEffectiveApiKey() instead,
         * which prefers this. */
        window.__e3dsApiKeyOverride = saved.apiKey;
    }

    if (typeof STREAMING_CONFIG === "undefined") return;

    if (saved.userName) {
        if (STREAMING_CONFIG.application
            && (!STREAMING_CONFIG.application.userName
                || STREAMING_CONFIG.application.userName === "demo")) {
            STREAMING_CONFIG.application.userName = saved.userName;
        }
    }

    /* [E3DS-SDK-APPNAME-GAP] A saved app name applies in two cases, and the
     * difference between them is the whole bug this replaced.
     *
     * It used to read `if (saved.appName)` and overwrite unconditionally - the
     * only field here that did not honour CODE WINS, three lines under the
     * comment describing exactly this bug and calling it "genuinely confusing
     * to chase". It was: sdk-config.js named one app, the file served over HTTP
     * said the same, and the page started a different one. Nothing in
     * the source was wrong, so the source is where you look - while the real
     * value sat in one browser's localStorage from some earlier session. It
     * follows that browser and no other, so it reads as a server or caching
     * fault, and it never expires.
     *
     * The fault was never the override itself. It was that the override was
     * INVISIBLE and UNREACHABLE: the panel only opened when the config was
     * incomplete, so once sdk-config.js was filled in there was no way from the page
     * to see or clear the value overriding it.
     *
     * So the two cases are kept apart:
     *
     *   a gap in sdk-config.js      -> apply, silently. Nothing is being overridden.
     *   appNameOverride: true   -> apply, and SAY SO in the console. This was
     *                              typed into the panel deliberately, on top of
     *                              a config that already had a value.
     *
     * A leftover without the flag - every entry saved before this existed - is
     * ignored when sdk-config.js has its own value, which is what makes the old
     * stale entries stop biting without anyone having to clear them. */
    if (saved.appName && STREAMING_CONFIG.application) {
        var configured = STREAMING_CONFIG.application.appName;
        if (!configured) {
            STREAMING_CONFIG.application.appName = saved.appName;
        } else if (saved.appNameOverride === true && saved.appName !== configured) {
            STREAMING_CONFIG.application.appName = saved.appName;
            /* Loud on purpose. An override that cannot be seen is the bug. */
            console.warn(
                '[E3DS] app name overridden in this browser: using "' + saved.appName
                + '" instead of sdk-config.js\'s "' + configured + '".'
                + ' Open the connection panel (e3dsOpenConnectionSetup()) to change or clear it.');
        }
    }
}

/** The key actually used, preferring the panel only where code left a gap. */
function e3dsEffectiveApiKey() {
    if (!e3dsApiKeyMissing()) return e3dsCurrentApiKey();
    return window.__e3dsApiKeyOverride || e3dsCurrentApiKey();
}

/**
 * Show the panel and resolve once the viewer has filled it in.
 *
 * Returns a promise rather than reloading the page, so the caller can simply
 * carry on: the demo starts immediately after Save with no second click.
 */
function e3dsShowConnectionSetup(problems, opts) {
    return new Promise((resolve) => {
        const saved = e3dsLoadSavedConnection();
        /* On demand means the viewer opened this themselves, with a working
         * config - so it is a settings screen, not a blocking prompt. It can be
         * dismissed, nothing is required, and the copy has to explain what is
         * currently winning rather than what is missing. */
        const onDemand = !!(opts && opts.onDemand);
        const configuredApp = (typeof STREAMING_CONFIG !== "undefined"
            && STREAMING_CONFIG.application) ? STREAMING_CONFIG.application.appName : "";
        const existing = document.getElementById("e3dsConnectionSetup");
        if (existing) existing.remove();

        const wrap = document.createElement("div");
        wrap.id = "e3dsConnectionSetup";
        wrap.setAttribute("role", "dialog");
        wrap.setAttribute("aria-modal", "true");
        wrap.style.cssText = [
            "position:fixed", "inset:0", "z-index:100010",   // [E3DS-DEMO-PHONE] above the controls panel (100000) and its phone button bar (100001), or they cover Cancel and Save
            "display:flex", "align-items:center", "justify-content:center",
            "background:rgba(0,0,0,.72)",
            "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
        ].join(";");

        /* [E3DS-SETUP-PREFILL] Show what sdk-config.js ALREADY has, not just what
         * this browser saved.
         *
         * The fields used to prefill from localStorage alone, so a config that
         * had the username and app set still presented three empty boxes. On a
         * phone that reads as "nothing is configured, type it all again" - and
         * it is wrong: usually only the API key is missing, and the other two
         * were correct all along. Now each field starts from the saved value if
         * there is one, otherwise from the configuration, and the hint underneath
         * says which of the two it came from.
         *
         * The API key is the exception: sdk-config.js ships a PLACEHOLDER, and
         * prefilling that would look like a key is present when none is. It is
         * treated as empty and called out as the missing one. */
        const configuredUser = (typeof STREAMING_CONFIG !== "undefined")
            ? ((STREAMING_CONFIG.application && STREAMING_CONFIG.application.userName) || "")
            : "";
        const keyIsReal = typeof e3dsApiKeyMissing === "function" ? !e3dsApiKeyMissing() : false;

        /* [E3DS-SDK-KEY-SCOPE] Same reason as e3dsCurrentApiKey: a const never
         * reaches window, so reading it there showed an empty field on a config
         * that was perfectly filled in. */
        const cfgKey = saved.apiKey || (keyIsReal ? e3dsCurrentApiKey() : "");
        const cfgUser = saved.userName || configuredUser;
        const cfgApp = saved.appName || configuredApp;

        /* Where a value came from, so nothing on this panel is a mystery. */
        const srcHint = (savedVal, configVal, fallback) =>
            savedVal ? "Saved in this browser. Overrides sdk-config.js."
            : configVal ? ("Already set in sdk-config.js as \"" + esc(configVal) + "\". Leave as is unless you are changing it.")
            : fallback;
        const keyHint = saved.apiKey
            ? "Saved in this browser."
            : keyIsReal ? "Already set in sdk-config.js."
            : "<b>MISSING</b> — sdk-config.js still has the placeholder. This is the one thing needed.";

        const esc = (s) => String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

        const field = (id, label, value, hint, type) => `
            <label style="display:block;margin:0 0 14px">
              <span style="display:block;font-size:13px;font-weight:600;margin:0 0 4px">${label}</span>
              <input id="${id}" type="${type || "text"}" value="${esc(value)}"
                     autocomplete="off" spellcheck="false"
                     style="width:100%;box-sizing:border-box;padding:9px 10px;font-size:14px;
                            border:1px solid #ccc;border-radius:6px;font-family:inherit">
              <span style="display:block;font-size:12px;opacity:.7;margin:4px 0 0">${hint}</span>
            </label>`;

        wrap.innerHTML = `
          <div style="background:#fff;color:#111;max-width:540px;width:calc(100% - 32px);
                      max-height:calc(100% - 32px);overflow:auto;padding:26px 28px;
                      border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.4)">
            <h2 style="margin:0 0 6px;font-size:19px">Eagle 3D Streaming — ${onDemand ? "connection settings" : "demo setup"}</h2>
            <p style="margin:0 0 18px;font-size:13.5px;line-height:1.5;opacity:.8">
              ${onDemand
                ? `What this browser has saved. These sit on top of <code>sdk-config.js</code>
                   and are stored here only — clearing them puts the file back in charge.`
                : `<code>sdk-config.js</code> has not been filled in, so enter the details here
                   instead. They are saved in this browser only.`}
            </p>
            ${onDemand && configuredApp ? `
              <p style="margin:0 0 18px;font-size:12.5px;line-height:1.5;padding:10px 12px;
                        background:#f2f7ff;border:1px solid #cfe0f5;border-radius:6px">
                <code>sdk-config.js</code> asks for <b>${esc(configuredApp)}</b>.
                ${saved.appName && saved.appName !== configuredApp
                  ? `This browser is overriding that with <b>${esc(saved.appName)}</b>.`
                  : `Leave the app field blank to keep using it.`}
              </p>` : ""}
            ${problems && problems.length ? `
              <ul style="margin:0 0 18px;padding:10px 12px 10px 28px;font-size:13px;
                         background:#fff4f4;border:1px solid #f2c9c9;border-radius:6px">
                ${problems.map((p) => `<li style="margin:2px 0">${esc(p)}</li>`).join("")}
              </ul>` : ""}
            ${field("e3dsSetKey", "Streaming API key",
                    cfgKey, keyHint, "password")}
            ${field("e3dsSetUser", "Username",
                    cfgUser, srcHint(saved.userName, configuredUser,
                      "Your account name. Used as the app owner and the viewer id."))}
            ${field("e3dsSetApp", "App name",
                    cfgApp, srcHint(saved.appName, configuredApp,
                      "Which app to run."))}
            <p style="margin:0 0 18px;font-size:12px;line-height:1.5;padding:10px 12px;
                      background:#fffbe6;border:1px solid #eadfa0;border-radius:6px">
              <b>Note:</b> a key entered here lives in this page, where anyone with
              devtools open can read it. That is fine for a demo. In production your
              own server should hold the key and hand the page only a session token.
            </p>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              ${onDemand ? `
              <button id="e3dsSetCancel" type="button"
                      style="padding:9px 14px;font-size:14px;border-radius:6px;
                             border:1px solid #ccc;background:#fff;cursor:pointer">Cancel</button>` : ""}
              <button id="e3dsSetClear" type="button"
                      style="padding:9px 14px;font-size:14px;border-radius:6px;
                             border:1px solid #ccc;background:#f6f6f6;cursor:pointer">Clear saved</button>
              <button id="e3dsSetSave" type="button"
                      style="padding:9px 18px;font-size:14px;border-radius:6px;border:0;
                             background:#0b6bcb;color:#fff;font-weight:600;cursor:pointer">${onDemand ? "Save" : "Save and start"}</button>
            </div>
          </div>`;

        document.body.appendChild(wrap);
        const keyInput = document.getElementById("e3dsSetKey");
        if (keyInput) keyInput.focus();

        document.getElementById("e3dsSetClear").onclick = () => {
            try { localStorage.removeItem(E3DS_SETTINGS_KEY); } catch (e) { /* nothing saved */ }
            document.getElementById("e3dsSetKey").value = "";
            document.getElementById("e3dsSetUser").value = "";
            document.getElementById("e3dsSetApp").value = "";
        };

        const save = () => {
            const apiKey = document.getElementById("e3dsSetKey").value.trim();
            const userName = document.getElementById("e3dsSetUser").value.trim();
            const appName = document.getElementById("e3dsSetApp").value.trim();

            /* Validated here rather than after closing: a panel that vanishes and
             * then reports the same failure is worse than one that stays put.
             *
             * Only demanded when the config cannot supply them. Opened on demand
             * against a working sdk-config.js, insisting on a key the file already
             * has would force the viewer to paste a secret in to change an
             * unrelated field - and they may not even have it. */
            const configSupplies = onDemand
                && !e3dsApiKeyMissing()
                && !!(typeof STREAMING_CONFIG !== "undefined"
                      && STREAMING_CONFIG.application
                      && STREAMING_CONFIG.application.userName);
            if (!configSupplies && (!apiKey || !userName)) {
                let warn = document.getElementById("e3dsSetWarn");
                if (!warn) {
                    warn = document.createElement("p");
                    warn.id = "e3dsSetWarn";
                    warn.style.cssText = "margin:0 0 12px;font-size:13px;color:#b00";
                    document.getElementById("e3dsSetSave").parentNode.before(warn);
                }
                warn.textContent = "The API key and username are both needed.";
                return;
            }

            /* [E3DS-SDK-APPNAME-GAP] Mark a deliberate override as deliberate.
             *
             * Set only when the viewer typed an app name that differs from the
             * one sdk-config.js already supplies. That is the single case where a
             * stored value is allowed to beat the file on a later load, and it
             * is flagged so a leftover can never be mistaken for a decision. */
            const settings = { apiKey, userName, appName };
            if (appName && configuredApp && appName !== configuredApp) {
                settings.appNameOverride = true;
            }

            e3dsSaveConnection(settings);
            /* Apply to the page that is already running, not just to the next
             * load: this panel can now be opened mid-session. */
            if (typeof STREAMING_CONFIG !== "undefined" && STREAMING_CONFIG.application) {
                STREAMING_CONFIG.application.appName = appName || configuredApp;
            }
            e3dsApplySavedConnection();
            wrap.remove();
            resolve(true);
        };

        document.getElementById("e3dsSetSave").onclick = save;

        if (onDemand) {
            /* Dismissable, because nothing is broken - it was opened on purpose.
             * The blocking form has no cancel by design: closing it would leave
             * the demo with a configuration that cannot start. */
            const dismiss = () => { wrap.remove(); resolve(false); };
            document.getElementById("e3dsSetCancel").onclick = dismiss;
            wrap.addEventListener("keydown", (ev) => { if (ev.key === "Escape") dismiss(); });
            wrap.addEventListener("mousedown", (ev) => { if (ev.target === wrap) dismiss(); });
        }

        wrap.addEventListener("keydown", (ev) => { if (ev.key === "Enter") save(); });
    });
}

/**
 * Open the settings panel at any time, whether or not anything is missing.
 *
 * WHY THIS EXISTS. The panel used to appear only when the configuration was
 * incomplete, which meant the values it saves became unreachable the moment the
 * configuration was complete - you could store an app name that overrode
 * sdk-config.js and then have no way to see it, change it, or clear it except by
 * editing localStorage in devtools. Asked for on 2026-09-09: "need to have
 * ability to call the ui and modify stuff there".
 *
 * Call it from anywhere:
 *
 *     e3dsOpenConnectionSetup();
 *
 * or press the demo's "Connection settings" button. Changes apply to the page
 * immediately - the next stream you start uses them, with no reload.
 *
 * @returns {Promise<boolean>} true if saved, false if dismissed.
 */
function e3dsOpenConnectionSetup() {
    return e3dsShowConnectionSetup(null, { onDemand: true });
}
/* PUBLIC ENTRY POINT for an integrator's own page - a different audience from
 * the rest of this file, which is internal to the panel.
 *
 * No `window.` assignment: these are classic scripts, so this declaration is
 * already a global. One was here and did nothing. */

/* Applied as soon as this file runs, so anything reading STREAMING_CONFIG
 * afterwards already sees the saved values and no caller needs to know this
 * file exists. Loaded after sdk-config.js and before sdk-token.js. */
e3dsApplySavedConnection();
