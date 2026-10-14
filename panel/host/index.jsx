/*
 * Suus Typeface - ExtendScript engine for Adobe Illustrator.
 *
 * Loaded by the CEP panel through the manifest's <ScriptPath>. The same file
 * is meant to serve a ScriptUI fallback palette as well, so it must not
 * depend on anything CEP-specific.
 *
 * ExtendScript is ES3: no let/const, arrow functions, Array.map/forEach/filter,
 * Array.indexOf, String.trim, JSON or Math.imul.
 *
 * Every public tt_* function returns a string:
 *   line 1        "OK: ..." or "FOUT: ..." (shown in the panel's status line)
 *   "@key=value"  data for the panel (value URL-encoded)
 *   other lines   debug details
 *
 * Library format: any document (.ai, .svg, .pdf) with groups named
 * "<CHAR>_<n>" (variant n of CHAR, e.g. "A_1"). Inside each group: items
 * named "L1" (shadow, bottom), "L2" (fill), "L3" (highlight, top) and an
 * invisible "_box" whose bounds define the cell: left/right = advance width,
 * bottom = baseline, height = cap height. Names may carry a prefix such as
 * "A_1-L1" (unique SVG ids). A group without L1/L2/L3 is used as-is as L2.
 */

var TT_VERSION = "0.2.0";
var TT_LAYER_NAMES = ["Type L1", "Type L2", "Type L3"];
var TT_LETTER_LAYER = "Type";
var TT_NOTE_KEYS = ["v", "id", "text", "lib", "size", "tracking", "wordspace", "leading",
    "align", "mode", "variants", "seed", "palette", "c1", "c2", "c3", "ox", "oy"];
var TT_TEST_FONTS = ["MyriadPro-Bold", "MinionPro-Bold", "Arial-BoldMT", "Georgia-Bold",
    "Impact", "Verdana-Bold", "TimesNewRomanPS-BoldMT", "Helvetica-Bold",
    "CourierNewPS-BoldMT", "MyriadPro-Regular", "MinionPro-Regular", "ArialMT"];

// ---------------------------------------------------------------- helpers

// Formats a caught error as a status string, including the line if known.
function tt_error(e) {
    var msg = (e && e.message) ? e.message : String(e);
    if (e && e.line) {
        msg += " (regel " + e.line + ")";
    }
    return "FOUT: " + msg;
}

function tt_trim(s) {
    return String(s).replace(/^\s+|\s+$/g, "");
}

function tt_data(key, value) {
    return "\n@" + key + "=" + encodeURIComponent(String(value));
}

function tt_num(value, fallback, min, max) {
    var n = parseFloat(value);
    if (isNaN(n)) {
        n = fallback;
    }
    if (n < min) {
        n = min;
    }
    if (n > max) {
        n = max;
    }
    return n;
}

function tt_hex(value, fallback) {
    var m = /^#?([0-9a-fA-F]{6})$/.exec(String(value || ""));
    return m ? m[1].toLowerCase() : fallback;
}

// Parses "a=1&b=two" (URL-encoded) into an object. No eval, no JSON.
function tt_parseParams(str) {
    var out = {};
    var pairs = String(str || "").split("&");
    for (var i = 0; i < pairs.length; i++) {
        if (!pairs[i]) {
            continue;
        }
        var eq = pairs[i].indexOf("=");
        var key = eq < 0 ? pairs[i] : pairs[i].substring(0, eq);
        var val = eq < 0 ? "" : pairs[i].substring(eq + 1);
        try {
            out[decodeURIComponent(key)] = decodeURIComponent(val);
        } catch (e) {
            // Skip a malformed pair.
        }
    }
    return out;
}

function tt_serializeParams(obj, keys) {
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
        if (obj[keys[i]] !== undefined) {
            parts.push(encodeURIComponent(keys[i]) + "=" + encodeURIComponent(String(obj[keys[i]])));
        }
    }
    return parts.join("&");
}

// Park-Miller "minimal standard" generator. 16807 * 2^31 < 2^53, so the
// multiplication stays exact in doubles (no Math.imul needed).
function TT_Random(seed) {
    this.state = Math.floor(seed) % 2147483647;
    if (this.state <= 0) {
        this.state += 2147483646;
    }
}

TT_Random.prototype.next = function () {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
};

function tt_newId() {
    var id = new Date().getTime().toString(36);
    for (var i = 0; i < 3; i++) {
        id += Math.floor(Math.random() * 36).toString(36);
    }
    return id;
}

// ---------------------------------------------------------------- geometry

// Sign of "down" in the scripting coordinate system: -1 when y grows
// upwards (top > bottom in geometricBounds), +1 when y grows downwards.
function tt_downSign(bounds) {
    return (bounds[1] - bounds[3]) >= 0 ? -1 : 1;
}

// Union of two [left, top, right, bottom] bounds, honouring the y direction.
function tt_union(a, b, down) {
    if (!a) {
        return [b[0], b[1], b[2], b[3]];
    }
    var top = down < 0 ? Math.max(a[1], b[1]) : Math.min(a[1], b[1]);
    var bottom = down < 0 ? Math.min(a[3], b[3]) : Math.max(a[3], b[3]);
    return [Math.min(a[0], b[0]), top, Math.max(a[2], b[2]), bottom];
}

// Moves an item so its geometric top-left lands on (x, y), via a delta on
// .position (position includes stroke width, geometricBounds does not).
function tt_moveTopLeft(item, x, y) {
    var b = item.geometricBounds;
    var pos = item.position;
    item.position = [pos[0] + (x - b[0]), pos[1] + (y - b[1])];
}

// ---------------------------------------------------------------- colour

function tt_makeColor(doc, hex) {
    var r = parseInt(hex.substr(0, 2), 16);
    var g = parseInt(hex.substr(2, 2), 16);
    var b = parseInt(hex.substr(4, 2), 16);
    if (doc.documentColorSpace === DocumentColorSpace.CMYK) {
        var rr = r / 255, gg = g / 255, bb = b / 255;
        var k = 1 - Math.max(rr, Math.max(gg, bb));
        var c = new CMYKColor();
        c.black = k * 100;
        c.cyan = k >= 1 ? 0 : (1 - rr - k) / (1 - k) * 100;
        c.magenta = k >= 1 ? 0 : (1 - gg - k) / (1 - k) * 100;
        c.yellow = k >= 1 ? 0 : (1 - bb - k) / (1 - k) * 100;
        return c;
    }
    var rgb = new RGBColor();
    rgb.red = r;
    rgb.green = g;
    rgb.blue = b;
    return rgb;
}

// Replaces fill and stroke colours recursively (only where they are set).
function tt_recolor(item, color) {
    var i;
    if (item.typename === "GroupItem") {
        for (i = 0; i < item.pageItems.length; i++) {
            tt_recolor(item.pageItems[i], color);
        }
    } else if (item.typename === "CompoundPathItem") {
        for (i = 0; i < item.pathItems.length; i++) {
            tt_recolor(item.pathItems[i], color);
        }
    } else if (item.typename === "PathItem" && !item.clipping) {
        if (item.filled) {
            item.fillColor = color;
        }
        if (item.stroked) {
            item.strokeColor = color;
        }
    }
}

// Sets fill/stroke on every path inside item. fill or stroke may be null
// (= none); strokeWidth is used when a stroke is set.
function tt_paint(item, fill, stroke, strokeWidth) {
    var i;
    if (item.typename === "GroupItem") {
        for (i = 0; i < item.pageItems.length; i++) {
            tt_paint(item.pageItems[i], fill, stroke, strokeWidth);
        }
    } else if (item.typename === "CompoundPathItem") {
        for (i = 0; i < item.pathItems.length; i++) {
            tt_paint(item.pathItems[i], fill, stroke, strokeWidth);
        }
    } else if (item.typename === "PathItem") {
        item.filled = fill !== null;
        if (fill !== null) {
            item.fillColor = fill;
        }
        item.stroked = stroke !== null;
        if (stroke !== null) {
            item.strokeColor = stroke;
            item.strokeWidth = strokeWidth;
            item.strokeJoin = StrokeJoin.ROUNDENDJOIN;
        }
    }
}

// ---------------------------------------------------------------- library

// Undoes the name mangling of Illustrator's SVG import: _xHH_ escapes and a
// trailing _N_ added to duplicate ids.
function tt_cleanName(name) {
    var s = String(name || "").replace(/_x([0-9A-Fa-f]{2})_/g, function (m, h) {
        return String.fromCharCode(parseInt(h, 16));
    });
    return tt_trim(s.replace(/_\d+_$/, ""));
}

// "A_1" -> { ch: "A", n: 1 }; "uni00C9_2" -> { ch: "É", n: 2 }; else null.
function tt_parseGlyphName(name) {
    var s = String(name || "").replace(/_x([0-9A-Fa-f]{2})_/g, function (m, h) {
        return String.fromCharCode(parseInt(h, 16));
    });
    var m = /^(.+?)[ _\-](\d+)(_\d+_)?$/.exec(tt_trim(s));
    if (!m) {
        return null;
    }
    var ch = m[1];
    var uni = /^(?:uni|U\+)([0-9A-Fa-f]{4})$/.exec(ch);
    if (uni) {
        ch = String.fromCharCode(parseInt(uni[1], 16));
    }
    if (ch.length !== 1) {
        return null;
    }
    return { ch: ch, n: parseInt(m[2], 10) };
}

function tt_samePath(doc, file) {
    try {
        return doc.fullName.fsName.toLowerCase() === file.fsName.toLowerCase();
    } catch (e) {
        return false; // unsaved document
    }
}

function tt_findOpenDoc(file) {
    for (var i = 0; i < app.documents.length; i++) {
        if (tt_samePath(app.documents[i], file)) {
            return app.documents[i];
        }
    }
    return null;
}

// Returns the open library document, opening it once if needed. The active
// document is switched back to returnTo afterwards.
function tt_openLibrary(path, returnTo) {
    var file = new File(path);
    if (!file.exists) {
        throw new Error("bibliotheek niet gevonden: " + file.fsName);
    }
    var doc = tt_findOpenDoc(file);
    if (doc) {
        return doc;
    }
    var level = app.userInteractionLevel;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    try {
        doc = app.open(file);
    } finally {
        app.userInteractionLevel = level;
    }
    if (returnTo) {
        app.activeDocument = returnTo;
    }
    return doc;
}

// Collects all glyph groups: { glyphs: { "A": [glyph, ...] }, chars, count }.
function tt_indexLibrary(doc) {
    var glyphs = {};
    var chars = [];
    var count = 0;
    var groups = doc.groupItems; // every group in the document, nested included
    for (var i = 0; i < groups.length; i++) {
        var parsed = tt_parseGlyphName(groups[i].name);
        if (!parsed) {
            continue;
        }
        var key = "c" + parsed.ch;
        if (!glyphs[key]) {
            glyphs[key] = [];
            chars.push(parsed.ch);
        }
        glyphs[key].push({ ch: parsed.ch, n: parsed.n, item: groups[i], info: null });
        count++;
    }
    for (var c = 0; c < chars.length; c++) {
        glyphs["c" + chars[c]].sort(function (a, b) {
            return a.n - b.n;
        });
    }
    chars.sort();
    return { glyphs: glyphs, chars: chars, count: count };
}

function tt_lookup(index, ch) {
    return index.glyphs["c" + ch] || index.glyphs["c" + ch.toUpperCase()] || null;
}

// Reads a glyph's parts and cell once: { layers: [[L1 items], [L2], [L3]], cell }.
function tt_glyphInfo(glyph) {
    if (glyph.info) {
        return glyph.info;
    }
    var layers = [[], [], []];
    var other = [];
    var box = null;
    var items = glyph.item.pageItems;
    for (var i = 0; i < items.length; i++) {
        var nm = tt_cleanName(items[i].name);
        var m = /(?:^|[^A-Za-z0-9])L([123])$/.exec(nm);
        if (m) {
            layers[parseInt(m[1], 10) - 1].push(items[i]);
        } else if (/(?:^|[^A-Za-z0-9])_?box$/i.test(nm)) {
            box = box || items[i];
        } else {
            other.push(items[i]);
        }
    }
    if (!layers[0].length && !layers[1].length && !layers[2].length) {
        layers[1] = other; // plain artwork without layer names: use it as the fill
    }
    var down = null;
    var cell = null;
    var parts = [];
    for (var n = 0; n < 3; n++) {
        for (var j = 0; j < layers[n].length; j++) {
            var b = layers[n][j].geometricBounds;
            if (down === null && b[1] !== b[3]) {
                down = tt_downSign(b);
            }
            parts.push({ item: layers[n][j], layer: n, bounds: b });
        }
    }
    if (box) {
        cell = box.geometricBounds;
        down = tt_downSign(cell);
    } else {
        for (var p = 0; p < parts.length; p++) {
            cell = tt_union(cell, parts[p].bounds, down === null ? -1 : down);
        }
    }
    glyph.info = {
        parts: parts,
        cell: cell,
        down: down === null ? -1 : down,
        width: cell ? cell[2] - cell[0] : 0,
        height: cell ? Math.abs(cell[1] - cell[3]) : 0,
        hasBox: !!box
    };
    return glyph.info;
}

// ---------------------------------------------------------------- settings

function tt_settings(p) {
    return {
        text: p.text === undefined ? "" : String(p.text),
        lib: String(p.lib || ""),
        size: tt_num(p.size, 100, 1, 10000),          // % of library size
        tracking: tt_num(p.tracking, 40, -1000, 5000), // 1/1000 of cap height
        wordspace: tt_num(p.wordspace, 35, 0, 1000),   // % of cap height
        leading: tt_num(p.leading, 125, 10, 1000),     // % of cap height
        align: (p.align === "center" || p.align === "right") ? p.align : "left",
        mode: p.mode === "letters" ? "letters" : "layers",
        variants: (p.variants === "cycle" || p.variants === "first") ? p.variants : "random",
        seed: Math.floor(tt_num(p.seed, 1, 0, 2147483646)),
        palette: p.palette === "1" ? 1 : 0,
        c1: tt_hex(p.c1, "2b2d42"),
        c2: tt_hex(p.c2, "e94f37"),
        c3: tt_hex(p.c3, "fff1d6"),
        id: /^[a-z0-9]+$/.test(String(p.id || "")) ? String(p.id) : "",
        debug: p.debug === "1"
    };
}

// ---------------------------------------------------------------- blocks

// Finds the groups of block `id` in doc: { items, bounds, note }.
function tt_findBlock(doc, id, down) {
    var re = new RegExp("^TT_" + id + "(_L[0-9])?$");
    var found = [];
    var i, j;
    var names = TT_LAYER_NAMES.concat([TT_LETTER_LAYER]);
    // Fast path: the top level of our own layers.
    for (i = 0; i < names.length; i++) {
        var layer = null;
        try {
            layer = doc.layers.getByName(names[i]);
        } catch (e) {
            layer = null;
        }
        if (!layer) {
            continue;
        }
        for (j = 0; j < layer.pageItems.length; j++) {
            if (re.test(layer.pageItems[j].name)) {
                found.push(layer.pageItems[j]);
            }
        }
    }
    // Slow path: the user may have moved (part of) the block elsewhere.
    var note = found.length ? tt_parseParams(found[0].note) : {};
    if (found.length < (note.mode === "letters" ? 1 : 3)) {
        found = [];
        for (i = 0; i < doc.groupItems.length; i++) {
            if (re.test(doc.groupItems[i].name)) {
                found.push(doc.groupItems[i]);
            }
        }
    }
    var bounds = null;
    for (i = 0; i < found.length; i++) {
        bounds = tt_union(bounds, found[i].geometricBounds, down);
    }
    return { items: found, bounds: bounds, note: found.length ? found[0].note : "" };
}

function tt_targetLayer(doc, name) {
    var layer = null;
    try {
        layer = doc.layers.getByName(name);
    } catch (e) {
        layer = null;
    }
    if (!layer) {
        layer = doc.layers.add();
        layer.name = name;
    }
    if (layer.locked) {
        layer.locked = false;
    }
    if (!layer.visible) {
        layer.visible = true;
    }
    return layer;
}

// Picks a variant: always the first, cyclic per character, or random per
// character without repeating the previous variant of that character.
function tt_pickVariant(list, st, state) {
    var n = list.length;
    var key = "c" + list[0].ch;
    if (n === 1 || st.variants === "first") {
        return list[0];
    }
    if (st.variants === "cycle") {
        var c = state.count[key] || 0;
        state.count[key] = c + 1;
        return list[c % n];
    }
    var last = state.last[key];
    var idx;
    if (last === undefined) {
        idx = Math.floor(state.rng.next() * n);
    } else {
        idx = Math.floor(state.rng.next() * (n - 1));
        if (idx >= last) {
            idx++;
        }
    }
    if (idx >= n) {
        idx = n - 1;
    }
    state.last[key] = idx;
    return list[idx];
}

// Splits text into lines of { glyph } / { space } entries.
function tt_layoutText(text, index, st, skipped) {
    var lines = [[]];
    var state = { rng: new TT_Random(st.seed), last: {}, count: {} };
    var seen = {};
    for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        if (ch === "\r" || ch === "\n") {
            if (ch === "\r" && text.charAt(i + 1) === "\n") {
                i++;
            }
            lines.push([]);
            continue;
        }
        if (ch === " " || ch === "\t" || ch === " ") {
            lines[lines.length - 1].push({ space: true });
            continue;
        }
        var list = tt_lookup(index, ch);
        if (!list) {
            var shown = ch.toUpperCase();
            if (!seen["c" + shown]) {
                seen["c" + shown] = true;
                skipped.push(shown);
            }
            continue;
        }
        lines[lines.length - 1].push({ glyph: tt_pickVariant(list, st, state) });
    }
    return lines;
}

// ---------------------------------------------------------------- public API

// Phase 0: round-trip test between the panel and Illustrator.
function tt_hello() {
    try {
        var docCount = app.documents.length;
        var active = docCount > 0 ? app.activeDocument.name : "geen";
        return "OK: Hallo vanuit Illustrator " + app.version +
            " - open documenten: " + docCount + ", actief: " + active;
    } catch (e) {
        return tt_error(e);
    }
}

// Extra details for the panel's debug log.
function tt_info() {
    try {
        return "OK: engine " + TT_VERSION +
            ", ExtendScript " + $.version +
            ", engineName '" + $.engineName + "'" +
            ", os " + $.os +
            ", locale " + app.locale;
    } catch (e) {
        return tt_error(e);
    }
}

// Lets the user pick a library file. Returns its path as @path.
function tt_chooseLibrary() {
    try {
        var isWin = $.os.indexOf("Windows") >= 0;
        var filter = isWin ? "Bibliotheek:*.ai;*.svg;*.pdf" : function (f) {
            return (f instanceof Folder) || /\.(ai|svg|pdf)$/i.test(f.name);
        };
        var file = File.openDialog("Kies een bibliotheekbestand (.ai of .svg)", filter, false);
        if (!file) {
            return "OK: geen bestand gekozen.";
        }
        return "OK: bibliotheek gekozen: " + file.displayName + tt_data("path", file.fsName);
    } catch (e) {
        return tt_error(e);
    }
}

// Reports which characters a library provides.
function tt_libraryInfo(path) {
    try {
        var target = app.documents.length ? app.activeDocument : null;
        var lib = tt_openLibrary(path, target);
        var index = tt_indexLibrary(lib);
        if (!index.count) {
            var names = [];
            for (var i = 0; i < lib.groupItems.length && names.length < 8; i++) {
                names.push("'" + lib.groupItems[i].name + "'");
            }
            return "FOUT: geen glyphs gevonden in " + lib.name +
                ". Groepen moeten heten als 'A_1'. Eerste groepsnamen: " + (names.join(", ") || "geen");
        }
        var parts = [];
        var missing = [];
        for (var c = 0; c < index.chars.length; c++) {
            parts.push(index.chars[c] + "×" + tt_lookup(index, index.chars[c]).length);
        }
        var abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (var a = 0; a < abc.length; a++) {
            if (!tt_lookup(index, abc.charAt(a))) {
                missing.push(abc.charAt(a));
            }
        }
        var first = tt_glyphInfo(tt_lookup(index, index.chars[0])[0]);
        return "OK: " + lib.name + ": " + index.chars.length + " tekens, " + index.count + " varianten" +
            (missing.length ? ". Ontbreekt: " + missing.join(" ") : "") +
            "\n" + parts.join(" ") +
            "\neerste glyph: lagen " + first.parts.length + ", _box " + (first.hasBox ? "ja" : "nee") +
            ", cel " + Math.round(first.width) + "×" + Math.round(first.height) + " pt";
    } catch (e) {
        return tt_error(e);
    }
}

// Phase 2: renders text from the library into the active document. params is
// a URL-encoded key=value string (see tt_settings). Replaces block `id` if it
// exists, keeping its top-left corner.
function tt_render(params) {
    var oldCoords = null;
    try {
        var t0 = new Date().getTime();
        var st = tt_settings(tt_parseParams(params));
        var log = [];
        if (!app.documents.length) {
            return "FOUT: geen document open. Maak eerst een document (Bestand > Nieuw).";
        }
        if (!st.lib) {
            return "FOUT: geen bibliotheek gekozen.";
        }
        if (!tt_trim(st.text)) {
            return "FOUT: typ eerst wat tekst.";
        }
        var doc = app.activeDocument;
        var libFile = new File(st.lib);
        if (tt_samePath(doc, libFile)) {
            return "FOUT: het actieve document is de bibliotheek zelf (" + doc.name +
                "). Activeer of maak een ander document.";
        }

        oldCoords = app.coordinateSystem;
        app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;

        var lib = tt_openLibrary(st.lib, doc);
        app.activeDocument = doc;
        var index = tt_indexLibrary(lib);
        if (!index.count) {
            return "FOUT: geen glyphs (groepen 'A_1', 'A_2', ...) gevonden in " + lib.name + ".";
        }

        var skipped = [];
        var lines = tt_layoutText(st.text, index, st, skipped);

        // Cap height and direction come from the first glyph that has a cell.
        var ref = null;
        var i, j, n, entry;
        for (i = 0; i < lines.length && !ref; i++) {
            for (j = 0; j < lines[i].length && !ref; j++) {
                if (lines[i][j].glyph && tt_glyphInfo(lines[i][j].glyph).cell) {
                    ref = tt_glyphInfo(lines[i][j].glyph);
                }
            }
        }
        if (!ref) {
            return "FOUT: geen van de tekens staat in de bibliotheek" +
                (skipped.length ? " (overgeslagen: " + skipped.join(" ") + ")." : ".");
        }
        var down = ref.down;
        var k = st.size / 100;
        var capH = ref.height * k;
        var track = st.tracking / 1000 * capH;
        var word = st.wordspace / 100 * capH;
        var lead = st.leading / 100 * capH;

        // Pass 1: x positions per line (layout space: x right, y down, in pt).
        var widths = [];
        var blockW = 0;
        for (i = 0; i < lines.length; i++) {
            var x = 0;
            var w = 0;
            for (j = 0; j < lines[i].length; j++) {
                entry = lines[i][j];
                if (entry.space) {
                    x += word;
                    continue;
                }
                var gi = tt_glyphInfo(entry.glyph);
                entry.x = x;
                w = x + gi.width * k;
                x = w + track;
            }
            widths.push(w);
            blockW = Math.max(blockW, w);
        }
        var blockH = capH + (lines.length - 1) * lead;

        // Origin (layout top-left in document coordinates).
        var originX, originY;
        var id = st.id;
        var old = id ? tt_findBlock(doc, id, down) : null;
        if (old && old.items.length) {
            var oldNote = tt_parseParams(old.note);
            originX = old.bounds[0] + tt_num(oldNote.ox, 0, -1e7, 1e7);
            originY = old.bounds[1] + tt_num(oldNote.oy, 0, -1e7, 1e7);
            for (i = 0; i < old.items.length; i++) {
                old.items[i].remove();
            }
            log.push("oud blok " + id + " vervangen (" + old.items.length + " groepen)");
        } else {
            var center = doc.activeView.centerPoint;
            originX = center[0] - blockW / 2;
            originY = center[1] - down * blockH / 2;
            log.push("nieuw blok rond beeldmidden " + Math.round(center[0]) + ", " + Math.round(center[1]));
            if (!id) {
                id = tt_newId();
            }
        }

        // Containers.
        var containers = [];
        var block = null;
        if (st.mode === "layers") {
            var layers = [];
            for (n = 0; n < 3; n++) {
                layers.push(tt_targetLayer(doc, TT_LAYER_NAMES[n]));
            }
            try {
                layers[1].move(layers[2], ElementPlacement.PLACEAFTER);
                layers[0].move(layers[1], ElementPlacement.PLACEAFTER);
            } catch (e1) {
                log.push("lagen niet herordend: " + e1.message);
            }
            for (n = 0; n < 3; n++) {
                var g = layers[n].groupItems.add();
                g.name = "TT_" + id + "_L" + (n + 1);
                containers.push({ group: g, layer: layers[n] });
            }
        } else {
            var letterLayer = tt_targetLayer(doc, TT_LETTER_LAYER);
            block = letterLayer.groupItems.add();
            block.name = "TT_" + id;
            containers.push({ group: block, layer: letterLayer });
        }

        var colors = null;
        if (st.palette) {
            colors = [tt_makeColor(doc, st.c1), tt_makeColor(doc, st.c2), tt_makeColor(doc, st.c3)];
        }
        var pct = st.size;
        var placed = 0;

        // Pass 2: duplicate, scale and position every part.
        for (i = 0; i < lines.length; i++) {
            var alignX = st.align === "center" ? (blockW - widths[i]) / 2 :
                (st.align === "right" ? blockW - widths[i] : 0);
            var baseline = capH + i * lead;
            for (j = 0; j < lines[i].length; j++) {
                entry = lines[i][j];
                if (!entry.glyph) {
                    continue;
                }
                var info = tt_glyphInfo(entry.glyph);
                var cellLeft = originX + alignX + entry.x;
                var cellTop = originY + down * (baseline - info.height * k);
                var letterGroup = null;
                if (block) {
                    letterGroup = block.groupItems.add();
                    letterGroup.name = entry.glyph.ch + "_" + entry.glyph.n;
                }
                for (var p = 0; p < info.parts.length; p++) {
                    var part = info.parts[p];
                    var target = block ? containers[0] : containers[part.layer];
                    var dup = part.item.duplicate(target.layer, ElementPlacement.PLACEATEND);
                    if (dup.locked) {
                        dup.locked = false;
                    }
                    if (dup.hidden) {
                        dup.hidden = false;
                    }
                    if (colors) {
                        tt_recolor(dup, colors[part.layer]);
                    }
                    if (pct !== 100) {
                        dup.resize(pct, pct, true, true, true, true, pct, Transformation.TOPLEFT);
                    }
                    var dx = (part.bounds[0] - info.cell[0]) * k;
                    var dyDown = (part.bounds[1] - info.cell[1]) * info.down * k;
                    tt_moveTopLeft(dup, cellLeft + dx, cellTop + down * dyDown);
                    if (letterGroup) {
                        // Parts arrive as L1, L2, L3; each goes on top of the previous.
                        dup.move(letterGroup, ElementPlacement.PLACEATBEGINNING);
                    } else {
                        dup.move(target.group, ElementPlacement.PLACEATEND);
                    }
                }
                placed++;
            }
        }

        // Drop empty containers (e.g. a library without L3).
        var kept = [];
        for (n = 0; n < containers.length; n++) {
            if (containers[n].group.pageItems.length) {
                kept.push(containers[n].group);
            } else {
                containers[n].group.remove();
            }
        }
        if (!kept.length) {
            return "FOUT: niets geplaatst.";
        }

        // Remember everything in the note of each block group.
        var bounds = null;
        for (n = 0; n < kept.length; n++) {
            bounds = tt_union(bounds, kept[n].geometricBounds, down);
        }
        var note = tt_serializeParams({
            v: 1, id: id, text: st.text, lib: st.lib, size: st.size, tracking: st.tracking,
            wordspace: st.wordspace, leading: st.leading, align: st.align, mode: st.mode,
            variants: st.variants, seed: st.seed, palette: st.palette, c1: st.c1, c2: st.c2, c3: st.c3,
            ox: Math.round((originX - bounds[0]) * 1000) / 1000,
            oy: Math.round((originY - bounds[1]) * 1000) / 1000
        }, TT_NOTE_KEYS);
        for (n = 0; n < kept.length; n++) {
            kept[n].note = note;
        }

        var msg = "OK: " + placed + " teken" + (placed === 1 ? "" : "s") + " geplaatst in blok " + id +
            (skipped.length ? ". Overgeslagen: " + skipped.join(" ") : "") + "." +
            tt_data("id", id);
        if (st.debug) {
            msg += "\n" + log.join("\n") +
                "\nbibliotheek " + lib.name + ": " + index.count + " varianten" +
                "\nrichting omlaag " + down + ", schaal " + k + ", kapitaalhoogte " + Math.round(capH * 10) / 10 + " pt" +
                "\nblok " + Math.round(blockW) + "×" + Math.round(blockH) + " pt, oorsprong " +
                Math.round(originX) + ", " + Math.round(originY) +
                "\ntijd " + (new Date().getTime() - t0) + " ms";
        }
        return msg;
    } catch (e) {
        return tt_error(e);
    } finally {
        if (oldCoords !== null) {
            try {
                app.coordinateSystem = oldCoords;
            } catch (e2) {
                // Leave it.
            }
        }
    }
}

// ---------------------------------------------------------------- phase 1

function tt_pickFonts(max) {
    var out = [];
    for (var i = 0; i < TT_TEST_FONTS.length && out.length < max; i++) {
        try {
            out.push(app.textFonts.getByName(TT_TEST_FONTS[i]));
        } catch (e) {
            // Not installed.
        }
    }
    if (!out.length && app.textFonts.length) {
        out.push(app.textFonts[0]);
    }
    return out;
}

// Outlines one character; returns { group, baseline } (baseline = y of the
// text anchor).
function tt_outlineChar(layer, ch, font, size) {
    var tf = layer.textFrames.add();
    tf.contents = ch;
    tf.textRange.characterAttributes.textFont = font;
    tf.textRange.characterAttributes.size = size;
    var baseline = tf.anchor[1];
    var group = tf.createOutline();
    return { group: group, baseline: baseline };
}

// Phase 1: builds a test library (A-Z, 3 variants) from system fonts and
// asks where to save it. Returns the saved path as @path.
function tt_makeTestLibrary() {
    try {
        var fonts = tt_pickFonts(3);
        if (!fonts.length) {
            return "FOUT: geen lettertypes gevonden.";
        }
        var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var cols = 6, cellW = 130, cellH = 150, margin = 40, size = 100;
        var rows = Math.ceil(letters.length * 3 / cols);
        var doc = app.documents.add(DocumentColorSpace.RGB, margin * 2 + cols * cellW, margin * 2 + rows * cellH);
        var layer = doc.layers[0];
        layer.name = "Bibliotheek";

        var dark = tt_makeColor(doc, "2b2d42");
        var light = tt_makeColor(doc, "ffffff");
        var fills = [tt_makeColor(doc, "e94f37"), tt_makeColor(doc, "3f88c5"), tt_makeColor(doc, "f2bb05")];

        // Cap height per font, measured on an outlined "H".
        var capHeights = [];
        var down = -1;
        for (var f = 0; f < fonts.length; f++) {
            var h = tt_outlineChar(layer, "H", fonts[f], size);
            var hb = h.group.geometricBounds;
            down = tt_downSign(hb);
            capHeights.push(Math.abs(hb[1] - hb[3]));
            h.group.remove();
        }

        var abBounds = doc.artboards[0].artboardRect; // [left, top, right, bottom]
        var count = 0;
        for (var i = 0; i < letters.length; i++) {
            for (var v = 0; v < 3; v++) {
                var fi = v % fonts.length;
                var o = tt_outlineChar(layer, letters.charAt(i), fonts[fi], size);
                var l2 = o.group;
                // Only one or two fonts available: vary the shape a little.
                if (v >= fonts.length) {
                    l2.rotate(v === 1 ? -6 : 5);
                    if (v === 2) {
                        l2.resize(92, 100);
                    }
                }
                var gb = l2.geometricBounds;
                tt_paint(l2, fills[v], null, 0);
                l2.name = "L2";

                var l1 = l2.duplicate();
                tt_paint(l1, dark, null, 0);
                l1.translate(4, down * 4);
                l1.name = "L1";

                var l3 = l2.duplicate();
                tt_paint(l3, null, light, 1.2);
                l3.translate(-1, -down * 1);
                l3.name = "L3";

                // Cell: letter width x cap height, bottom edge on the baseline.
                var box = layer.pathItems.rectangle(0, 0, gb[2] - gb[0], capHeights[fi]);
                box.filled = false;
                box.stroked = false;
                box.name = "_box";
                tt_moveTopLeft(box, gb[0], o.baseline - down * capHeights[fi]);

                var glyph = layer.groupItems.add();
                glyph.name = letters.charAt(i) + "_" + (v + 1);
                box.move(glyph, ElementPlacement.PLACEATEND);
                l3.move(glyph, ElementPlacement.PLACEATEND);
                l2.move(glyph, ElementPlacement.PLACEATEND);
                l1.move(glyph, ElementPlacement.PLACEATEND);

                // Place in the grid by the cell's top-left.
                var slot = i * 3 + v;
                var bb = box.geometricBounds;
                var gx = abBounds[0] + margin + (slot % cols) * cellW;
                var gy = abBounds[1] + down * (margin + Math.floor(slot / cols) * cellH);
                glyph.translate(gx - bb[0], gy - bb[1]);
                count++;
            }
        }

        var names = [];
        for (var n = 0; n < fonts.length; n++) {
            names.push(fonts[n].name);
        }
        var fontInfo = "lettertype" + (fonts.length === 1 ? "" : "s") + ": " + names.join(", ");

        var isWin = $.os.indexOf("Windows") >= 0;
        var file = new File(Folder.desktop + "/suus-testbibliotheek.ai")
            .saveDlg("Testbibliotheek opslaan", isWin ? "Illustrator:*.ai" : undefined);
        if (!file) {
            return "OK: testbibliotheek gemaakt (" + count + " glyphs, " + fontInfo +
                ") maar niet opgeslagen. Sla hem op als .ai om hem als bibliotheek te gebruiken.";
        }
        if (!/\.ai$/i.test(file.name)) {
            file = new File(file.fsName + ".ai");
        }
        doc.saveAs(file, new IllustratorSaveOptions());
        return "OK: testbibliotheek opgeslagen (" + count + " glyphs, " + fontInfo + "): " +
            file.displayName + tt_data("path", file.fsName);
    } catch (e) {
        return tt_error(e);
    }
}
