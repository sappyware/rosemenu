.pragma library

var SEP = " -_./";

function lower(s) { return s ? String(s).toLowerCase() : ""; }

// Turn DesktopEntry objects into plain records (done once per app-list change).
function buildRecords(entries) {
    var out = [];
    if (!entries) return out;
    for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.noDisplay) continue;
        var kw = "";
        try { kw = (e.keywords || []).join(" "); } catch (err) { kw = ""; }
        var exec = "";
        try { exec = (e.command && e.command.length) ? String(e.command[0]).split("/").pop() : ""; } catch (err2) { exec = ""; }
        out.push({
            id: e.id || e.name,
            name: e.name || "",
            comment: e.comment || e.genericName || "",
            icon: e.icon || "",
            entry: e,
            lname: lower(e.name),
            lgeneric: lower(e.genericName),
            lkeywords: lower(kw),
            lcomment: lower(e.comment),
            lexec: lower(exec)
        });
    }
    return out;
}

function fuzzy(q, t) {
    var qi = 0, score = 0, prev = -2;
    for (var ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t.charAt(ti) === q.charAt(qi)) {
            score += 1;
            if (ti === prev + 1) score += 2;
            if (ti === 0 || SEP.indexOf(t.charAt(ti - 1)) >= 0) score += 3;
            prev = ti;
            qi++;
        }
    }
    return qi === q.length ? 50 + score : 0;
}

function field(q, t) {
    if (!t) return 0;
    if (t === q) return 1000;
    var idx = t.indexOf(q);
    if (idx === 0) return 800 - Math.min(t.length, 100) * 0.5;
    if (idx > 0) return (SEP.indexOf(t.charAt(idx - 1)) >= 0 ? 600 : 400) - idx;
    return fuzzy(q, t);
}

function tokenScore(q, r) {
    return Math.max(
        field(q, r.lname),
        field(q, r.lgeneric) * 0.7,
        field(q, r.lkeywords) * 0.6,
        field(q, r.lexec) * 0.6,
        field(q, r.lcomment) * 0.4
    );
}

// Every space-separated word must match something. Ties -> usage -> name.
function run(records, query, usage, limit) {
    var tokens = lower(query).trim().split(/\s+/).filter(function (t) { return t !== ""; });
    var scored = [];
    for (var i = 0; i < records.length; i++) {
        var r = records[i];
        var u = (usage && usage[r.id]) ? usage[r.id] : 0;
        var s = 0;
        if (tokens.length > 0) {
            var ok = true;
            for (var j = 0; j < tokens.length; j++) {
                var ts = tokenScore(tokens[j], r);
                if (ts <= 0) { ok = false; break; }
                s += ts;
            }
            if (!ok) continue;
            s += Math.min(u, 20) * 3;
        }
        scored.push({ r: r, s: s, u: u });
    }
    scored.sort(function (a, b) {
        if (b.s !== a.s) return b.s - a.s;
        if (b.u !== a.u) return b.u - a.u;
        return a.r.lname < b.r.lname ? -1 : (a.r.lname > b.r.lname ? 1 : 0);
    });
    var out = [];
    for (var k = 0; k < scored.length && k < limit; k++) out.push(scored[k].r);
    return out;
}
