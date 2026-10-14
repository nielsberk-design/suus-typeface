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
    var DEFAULT_LIBRARY = "/library/suus-penseel.svg";
    var PREF_PREFIX = "suustypeface.";
    var THEME_EVENT = "com.adobe.csxs.events.ThemeColorChanged";
    var LIVE_DELAY = 600;

    var DEFAULTS = {
        text: "SUUS",
        size: 100,
        tracking: 40,
        wordspace: 35,
        leading: 125,
        align: "left",
        mode: "layers",
        variants: "random",
        seed: 1,
        palette: false,
        c1: "#2b2d42",
        c2: "#e94f37",
        c3: "#fff1d6"
    };
    var SLIDERS = ["size", "tracking", "wordspace", "leading"];

    var el = {};
    var currentId = "";   // block that "Bijwerken" replaces
    var libraryPath = ""; // "" = the library bundled with the panel
    var busy = false;
    var pending = false;
    var liveTimer = null;

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
        return el.chkDebug.checked;
    }

    function setStatus(text) {
        var isError = /^FOUT/.test(text);
        el.status.textContent = text;
        el.status.className = "status " + (isError ? "error" : "ok");
    }

    function log(message) {
        if (!isDebug()) {
            return;
        }
        var time = new Date().toTimeString().substr(0, 8);
        el.log.textContent = time + "  " + message + "\n" + el.log.textContent;
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

    // Splits an engine reply into { text, data }: "@key=value" lines are data,
    // the other lines are the message.
    function parseReply(reply) {
        var lines = String(reply).split("\n");
        var text = [];
        var data = {};
        for (var i = 0; i < lines.length; i++) {
            var m = /^@([a-z]+)=(.*)$/.exec(lines[i]);
            if (m) {
                try {
                    data[m[1]] = decodeURIComponent(m[2]);
                } catch (e) {
                    data[m[1]] = m[2];
                }
            } else if (lines[i] !== "") {
                text.push(lines[i]);
            }
        }
        return { text: text.join("\n"), data: data, ok: /^OK/.test(lines[0]) };
    }

    // Calls fnName(args...) in Illustrator and passes the parsed reply on.
    function callHost(fnName, args, callback) {
        var parts = [];
        for (var i = 0; i < args.length; i++) {
            parts.push(toLiteral(args[i]));
        }
        var script = fnName + "(" + parts.join(",") + ")";
        log("evalScript: " + (script.length > 300 ? script.substr(0, 300) + "\u2026" : script));
        cep.evalScript(script, function (result) {
            log("resultaat: " + result);
            if (result === "EvalScript error." || result === undefined || result === null) {
                result = "FOUT: script-fout in Illustrator bij " + fnName +
                    " (zet Debug aan voor details).";
            }
            callback(parseReply(result));
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
        cep.evalScript("typeof tt_render", function (type) {
            if (type === "function") {
                callback(true);
                return;
            }
            var file = extensionPath() + HOST_FILE;
            log("host-script niet geladen (typeof tt_render = " + type + "), laad " + file);
            cep.evalScript("$.evalFile(" + toLiteral(file) + ")", function (result) {
                log("$.evalFile: " + result);
                cep.evalScript("typeof tt_render", function (type2) {
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
        root.setProperty("--primary", dark ? "#2d6fd0" : "#1473e6");
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
        el.footer.textContent = "Host: " + host + " \u00b7 CEP " + cepVersion();
    }

    function logEnvironment() {
        log("CEP-versie: " + cepVersion());
        log("extensiemap: " + extensionPath());
        log("hostomgeving: " + cep.getHostEnvironment());
        callHost("tt_info", [], function (reply) {
            log("engine: " + reply.text);
        });
    }

    // ---- settings ----------------------------------------------------------

    function radioValue(name) {
        var inputs = document.getElementsByName(name);
        for (var i = 0; i < inputs.length; i++) {
            if (inputs[i].checked) {
                return inputs[i].value;
            }
        }
        return DEFAULTS[name];
    }

    function setRadio(name, value) {
        var inputs = document.getElementsByName(name);
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].checked = inputs[i].value === value;
            inputs[i].parentNode.className = inputs[i].checked ? "on" : "";
        }
    }

    function numberValue(input, fallback) {
        var n = parseFloat(input.value);
        return isNaN(n) ? fallback : n;
    }

    function readSettings() {
        return {
            text: el.txt.value,
            size: numberValue(el.numSize, DEFAULTS.size),
            tracking: numberValue(el.numTracking, DEFAULTS.tracking),
            wordspace: numberValue(el.numWordspace, DEFAULTS.wordspace),
            leading: numberValue(el.numLeading, DEFAULTS.leading),
            align: radioValue("align"),
            mode: radioValue("mode"),
            variants: el.selVariants.value,
            seed: Math.floor(numberValue(el.numSeed, DEFAULTS.seed)),
            palette: el.chkPalette.checked,
            c1: el.colC1.value,
            c2: el.colC2.value,
            c3: el.colC3.value
        };
    }

    function applySettings(s) {
        el.txt.value = s.text;
        for (var i = 0; i < SLIDERS.length; i++) {
            var key = SLIDERS[i];
            var cap = key.charAt(0).toUpperCase() + key.substr(1);
            el["num" + cap].value = s[key];
            el["rng" + cap].value = s[key];
        }
        setRadio("align", s.align);
        setRadio("mode", s.mode);
        el.selVariants.value = s.variants;
        el.numSeed.value = s.seed;
        el.chkPalette.checked = !!s.palette;
        el.colC1.value = s.c1;
        el.colC2.value = s.c2;
        el.colC3.value = s.c3;
    }

    // Stored as one URL-encoded key=value string, like the engine's notes.
    function saveSettings() {
        var s = readSettings();
        var parts = [];
        for (var key in s) {
            if (s.hasOwnProperty(key)) {
                parts.push(key + "=" + encodeURIComponent(String(s[key])));
            }
        }
        savePref("settings", parts.join("&"));
    }

    function loadSettings() {
        var s = {};
        var key;
        for (key in DEFAULTS) {
            if (DEFAULTS.hasOwnProperty(key)) {
                s[key] = DEFAULTS[key];
            }
        }
        var stored = loadPref("settings");
        if (stored) {
            var pairs = stored.split("&");
            for (var i = 0; i < pairs.length; i++) {
                var eq = pairs[i].indexOf("=");
                key = pairs[i].substring(0, eq);
                if (eq > 0 && DEFAULTS.hasOwnProperty(key)) {
                    var value = decodeURIComponent(pairs[i].substring(eq + 1));
                    if (typeof DEFAULTS[key] === "number") {
                        value = parseFloat(value);
                        if (isNaN(value)) {
                            value = DEFAULTS[key];
                        }
                    } else if (typeof DEFAULTS[key] === "boolean") {
                        value = value === "true";
                    }
                    s[key] = value;
                }
            }
        }
        return s;
    }

    function renderParams() {
        var s = readSettings();
        var p = {
            text: s.text,
            lib: activeLibrary(),
            size: s.size,
            tracking: s.tracking,
            wordspace: s.wordspace,
            leading: s.leading,
            align: s.align,
            mode: s.mode,
            variants: s.variants,
            seed: s.seed,
            palette: s.palette ? "1" : "0",
            c1: s.c1,
            c2: s.c2,
            c3: s.c3,
            id: currentId,
            debug: isDebug() ? "1" : "0"
        };
        var parts = [];
        for (var key in p) {
            if (p.hasOwnProperty(key)) {
                parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(p[key])));
            }
        }
        return parts.join("&");
    }

    // ---- library -----------------------------------------------------------

    function defaultLibrary() {
        return extensionPath() + DEFAULT_LIBRARY;
    }

    function activeLibrary() {
        return libraryPath || defaultLibrary();
    }

    function fileName(path) {
        return path.replace(/^.*[\\\/]/, "");
    }

    function setLibrary(path) {
        libraryPath = path || "";
        savePref("library", libraryPath);
        el.libName.textContent = libraryPath ? fileName(libraryPath) : "Suus penseel (standaard)";
        el.libName.title = activeLibrary();
    }

    // ---- actions -----------------------------------------------------------

    function updateRenderButton() {
        el.btnRender.textContent = currentId ? "Bijwerken" : "Plaats";
        el.btnNew.disabled = !currentId;
    }

    // Renders now; while a render is running, queue one more.
    function render() {
        if (busy) {
            pending = true;
            return;
        }
        busy = true;
        pending = false;
        setStatus("Bezig\u2026");
        callHost("tt_render", [renderParams()], function (reply) {
            busy = false;
            if (reply.ok && reply.data.id) {
                currentId = reply.data.id;
                updateRenderButton();
            }
            setStatus(reply.text);
            if (pending) {
                render();
            }
        });
    }

    function scheduleLive() {
        saveSettings();
        if (!el.chkLive.checked) {
            return;
        }
        if (liveTimer) {
            clearTimeout(liveTimer);
        }
        liveTimer = setTimeout(function () {
            liveTimer = null;
            render();
        }, LIVE_DELAY);
    }

    function runSimple(fnName, args, onData) {
        setStatus("Bezig\u2026");
        callHost(fnName, args, function (reply) {
            setStatus(reply.text);
            if (reply.ok && onData) {
                onData(reply.data);
            }
        });
    }

    // ---- wiring ------------------------------------------------------------

    function bindSlider(key) {
        var cap = key.charAt(0).toUpperCase() + key.substr(1);
        var range = el["rng" + cap];
        var num = el["num" + cap];
        range.addEventListener("input", function () {
            num.value = range.value;
            scheduleLive();
        });
        num.addEventListener("input", function () {
            range.value = num.value;
            scheduleLive();
        });
    }

    function bindSegmented(name) {
        var inputs = document.getElementsByName(name);
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].addEventListener("change", function () {
                setRadio(name, radioValue(name));
                scheduleLive();
            });
        }
    }

    function collectElements() {
        var ids = ["txt", "btnRender", "btnNew", "chkLive", "libName", "btnChooseLib", "btnDefaultLib",
            "btnCheckLib", "btnTestLib", "rngSize", "numSize", "rngTracking", "numTracking",
            "rngWordspace", "numWordspace", "rngLeading", "numLeading", "selVariants", "numSeed",
            "btnSeed", "chkPalette", "colC1", "colC2", "colC3", "btnHello", "chkDebug",
            "status", "log", "footer"];
        for (var i = 0; i < ids.length; i++) {
            el[ids[i]] = document.getElementById(ids[i]);
        }
    }

    function init() {
        collectElements();

        el.chkDebug.checked = loadPref("debug") === "1";
        document.body.className = el.chkDebug.checked ? "debug" : "";
        el.chkDebug.addEventListener("change", function () {
            savePref("debug", el.chkDebug.checked ? "1" : "0");
            document.body.className = el.chkDebug.checked ? "debug" : "";
            if (el.chkDebug.checked && cep) {
                logEnvironment();
            }
        });

        applySettings(loadSettings());
        el.chkLive.checked = loadPref("live") === "1";
        updateRenderButton();

        if (!cep) {
            setStatus("FOUT: geen CEP-omgeving gevonden. Open dit paneel via " +
                "Venster > Extensies in Illustrator.");
            return;
        }

        applyTheme();
        cep.addEventListener(THEME_EVENT, applyTheme);
        showFooter();
        setLibrary(loadPref("library") || "");

        el.txt.addEventListener("input", scheduleLive);
        for (var i = 0; i < SLIDERS.length; i++) {
            bindSlider(SLIDERS[i]);
        }
        bindSegmented("align");
        bindSegmented("mode");
        var changeInputs = [el.selVariants, el.numSeed, el.chkPalette, el.colC1, el.colC2, el.colC3];
        for (var j = 0; j < changeInputs.length; j++) {
            changeInputs[j].addEventListener("change", scheduleLive);
        }
        el.chkLive.addEventListener("change", function () {
            savePref("live", el.chkLive.checked ? "1" : "0");
            if (el.chkLive.checked) {
                scheduleLive();
            }
        });

        el.btnRender.addEventListener("click", function () {
            saveSettings();
            render();
        });
        el.btnNew.addEventListener("click", function () {
            currentId = "";
            updateRenderButton();
            setStatus("OK: de volgende keer wordt een nieuw blok geplaatst.");
        });
        el.btnSeed.addEventListener("click", function () {
            el.numSeed.value = Math.floor(Math.random() * 100000);
            scheduleLive();
        });
        el.btnChooseLib.addEventListener("click", function () {
            runSimple("tt_chooseLibrary", [], function (data) {
                if (data.path) {
                    setLibrary(data.path);
                }
            });
        });
        el.btnDefaultLib.addEventListener("click", function () {
            setLibrary("");
            setStatus("OK: standaardbibliotheek (Suus penseel) gekozen.");
        });
        el.btnCheckLib.addEventListener("click", function () {
            runSimple("tt_libraryInfo", [activeLibrary()]);
        });
        el.btnTestLib.addEventListener("click", function () {
            runSimple("tt_makeTestLibrary", [], function (data) {
                if (data.path) {
                    setLibrary(data.path);
                    setStatus(el.status.textContent + "\nDeze is nu de gekozen bibliotheek. " +
                        "Maak een nieuw document (Bestand > Nieuw) en klik op Plaats.");
                }
            });
        });
        el.btnHello.addEventListener("click", function () {
            runSimple("tt_hello", []);
        });

        ensureHost(function (ok) {
            setStatus(ok
                ? "Klaar. Typ tekst en klik op \u2018Plaats\u2019."
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
