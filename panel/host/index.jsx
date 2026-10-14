/*
 * Suus Typeface - ExtendScript engine for Adobe Illustrator.
 *
 * Loaded by the CEP panel through the manifest's <ScriptPath>. The same file
 * is meant to serve a ScriptUI fallback palette as well, so it must not
 * depend on anything CEP-specific.
 *
 * ExtendScript is ES3: no let/const, arrow functions, Array.map/forEach/filter,
 * JSON or Math.imul. Every public tt_* function returns a string that starts
 * with "OK" on success or "FOUT" on failure; the panel shows it as-is.
 */

var TT_VERSION = "0.0.1";

// Formats a caught error as a status string, including the line if known.
function tt_error(e) {
    var msg = (e && e.message) ? e.message : String(e);
    if (e && e.line) {
        msg += " (regel " + e.line + ")";
    }
    return "FOUT: " + msg;
}

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
