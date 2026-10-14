/*
 * Suus Typeface - CEP panel script.
 *
 * Runs in the panel's embedded Chromium, not in Illustrator. Talks to the
 * ExtendScript engine (host/index.jsx) through window.__adobe_cep__.evalScript
 * directly; CSInterface.js is intentionally not used. Kept to plain ES5 so it
 * also runs in the older Chromium that ships with CEP 9.
 */
(function () {
    "use strict";

    var cep = window.__adobe_cep__;
    var HOST_FILE = "/host/index.jsx";
    var PREF_PREFIX = "suustypeface.";
    var THEME_EVENT = "com.adobe.csxs.events.ThemeColorChanged";

    var statusEl, logEl, debugEl, footerEl, helloBtn;

    // ---- preferences (localStorage) ----------------------------------------

    function loadPref(key) {
        try {
            return window.localStorage.getItem(PREF_PREFIX + key);
        } catch (e) {
            return null;
        }
    }

    function savePref(key, value) {
        try {
            window.localStorage.setItem(PREF_PREFIX + key, value);
        } catch (e) {
            // Storage unavailable; the setting just won't be remembered.
        }
    }

    // ---- status line and debug log -----------------------------------------

    function isDebug() {
        return debugEl.checked;
    }

    function setStatus(text) {
        var isError = /^FOUT/.test(text);
        statusEl.textContent = text;
        statusEl.className = "status " + (isError ? "error" : "ok");
    }

    function log(message) {
        if (!isDebug()) {
            return;
        }
        var time = new Date().toTimeString().substr(0, 8);
        logEl.textContent = time + "  " + message + "\n" + logEl.textContent;
    }

    // ---- calling the ExtendScript engine -----------------------------------

    // Encodes a value as an ExtendScript (ES3) literal for use in evalScript.
    function toLiteral(value) {
        if (typeof value === "number") {
            return isFinite(value) ? String(value) : "0";
        }
        if (typeof value === "boolean") {
            return value ? "true" : "false";
        }
        // JSON string syntax is valid ES3, except that U+2028/U+2029 are
        // line terminators there and must be escaped.
        return JSON.stringify(String(value))
            .replace(/\u2028/g, "\\u2028")
            .replace(/\u2029/g, "\\u2029");
    }

    // Calls fnName(args...) in Illustrator and passes the result string on.
    function callHost(fnName, args, callback) {
        var parts = [];
        for (var i = 0; i < args.length; i++) {
            parts.push(toLiteral(args[i]));
        }
        var script = fnName + "(" + parts.join(",") + ")";
        log("evalScript: " + script);
        cep.evalScript(script, function (result) {
            log("resultaat: " + result);
            if (result === "EvalScript error." || result === undefined || result === null) {
                result = "FOUT: script-fout in Illustrator bij " + fnName +
                    " (zet Debug aan voor details).";
            }
            callback(String(result));
        });
    }

    // Absolute path of the installed extension folder, without file:// prefix.
    function extensionPath() {
        var path = cep.getSystemPath("extension");
        try {
            path = decodeURI(path);
        } catch (e) {
            // Keep the raw value.
        }
        // Windows: file:///C:/...  macOS: file:///Users/...
        return path.replace(/^file:\/\/\/(?=[A-Za-z]:)/, "").replace(/^file:\/\//, "");
    }

    // Makes sure host/index.jsx is loaded. The manifest's ScriptPath normally
    // does this; if it didn't (or the file had an error), load it explicitly.
    function ensureHost(callback) {
        cep.evalScript("typeof tt_hello", function (type) {
            if (type === "function") {
                callback(true);
                return;
            }
            var file = extensionPath() + HOST_FILE;
            log("host-script niet geladen (typeof tt_hello = " + type + "), laad " + file);
            cep.evalScript("$.evalFile(" + toLiteral(file) + ")", function (result) {
                log("$.evalFile: " + result);
                cep.evalScript("typeof tt_hello", function (type2) {
                    callback(type2 === "function");
                });
            });
        });
    }

    // ---- theme -------------------------------------------------------------

    function readHostEnvironment() {
        try {
            return JSON.parse(cep.getHostEnvironment());
        } catch (e) {
            return null;
        }
    }

    function rgb(c, delta) {
        function channel(v) {
            return Math.max(0, Math.min(255, Math.round(v + delta)));
        }
        return "rgb(" + channel(c.red) + "," + channel(c.green) + "," + channel(c.blue) + ")";
    }

    function applyTheme() {
        var env = readHostEnvironment();
        if (!env || !env.appSkinInfo) {
            log("thema: geen appSkinInfo, standaardkleuren blijven staan");
            return;
        }
        var skin = env.appSkinInfo;
        var c = skin.panelBackgroundColor.color;
        var dark = (0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) < 128;
        var root = document.documentElement.style;

        root.setProperty("--bg", rgb(c, 0));
        root.setProperty("--fg", dark ? "#dcdcdc" : "#222222");
        root.setProperty("--muted", dark ? "#9a9a9a" : "#666666");
        root.setProperty("--field", rgb(c, dark ? -12 : 14));
        root.setProperty("--border", rgb(c, dark ? 26 : -40));
        root.setProperty("--button", rgb(c, dark ? 18 : 12));
        root.setProperty("--button-hover", rgb(c, dark ? 30 : 22));
        root.setProperty("--ok", dark ? "#8cc68c" : "#3b8a3b");
        root.setProperty("--error", dark ? "#ff8a7a" : "#c0392b");
        if (skin.baseFontFamily) {
            root.setProperty("--font", "\"" + skin.baseFontFamily + "\", " +
                "\"Segoe UI\", -apple-system, \"Helvetica Neue\", Arial, sans-serif");
        }
        if (skin.baseFontSize) {
            root.setProperty("--font-size", skin.baseFontSize + "px");
        }
        log("thema: achtergrond " + rgb(c, 0) + (dark ? " (donker)" : " (licht)"));
    }

    // ---- info --------------------------------------------------------------

    function cepVersion() {
        try {
            var v = JSON.parse(cep.getCurrentApiVersion());
            return v.major + "." + v.minor + "." + v.micro;
        } catch (e) {
            return "?";
        }
    }

    function showFooter() {
        var env = readHostEnvironment();
        var host = env ? env.appName + " " + env.appVersion : "onbekend";
        footerEl.textContent = "Host: " + host + " \u00b7 CEP " + cepVersion();
    }

    function logEnvironment() {
        log("CEP-versie: " + cepVersion());
        log("extensiemap: " + extensionPath());
        log("hostomgeving: " + cep.getHostEnvironment());
        callHost("tt_info", [], function (result) {
            log("engine: " + result);
        });
    }

    // ---- actions -----------------------------------------------------------

    function onHello() {
        helloBtn.disabled = true;
        setStatus("Bezig\u2026");
        callHost("tt_hello", [], function (result) {
            helloBtn.disabled = false;
            setStatus(result);
        });
    }

    // ---- init --------------------------------------------------------------

    function init() {
        statusEl = document.getElementById("status");
        logEl = document.getElementById("log");
        debugEl = document.getElementById("chkDebug");
        footerEl = document.getElementById("footer");
        helloBtn = document.getElementById("btnHello");

        debugEl.checked = loadPref("debug") === "1";
        document.body.className = debugEl.checked ? "debug" : "";
        debugEl.addEventListener("change", function () {
            savePref("debug", debugEl.checked ? "1" : "0");
            document.body.className = debugEl.checked ? "debug" : "";
            if (debugEl.checked) {
                logEnvironment();
            }
        });

        if (!cep) {
            helloBtn.disabled = true;
            setStatus("FOUT: geen CEP-omgeving gevonden. Open dit paneel via " +
                "Venster > Extensies in Illustrator.");
            return;
        }

        applyTheme();
        cep.addEventListener(THEME_EVENT, applyTheme);
        showFooter();
        helloBtn.addEventListener("click", onHello);

        ensureHost(function (ok) {
            setStatus(ok
                ? "Klaar. Klik op \u2018Test verbinding\u2019."
                : "FOUT: host/index.jsx kon niet geladen worden (zet Debug aan voor details).");
            if (isDebug()) {
                logEnvironment();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
}());
