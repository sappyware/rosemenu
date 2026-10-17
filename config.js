
.pragma library

var PALETTE_KEYS = [
    "bg", "surface", "border", "fg", "muted", "accent",
    "selected_from", "selected_to", "selected_fg", "hover", "urgent"
];

function theme(v) {
    var o = {};
    for (var i = 0; i < PALETTE_KEYS.length; i++) {
        o[PALETTE_KEYS[i]] = v[i];
    }
    return o;
}

var THEMES = {
    "catppuccin-mocha": theme([
        "#181825", "#1e1e2e", "#313244", "#cdd6f4", "#9399b2",
        "#f5c2e7", "#c8cbf9", "#f2d0d0", "#1e1e2e", "#313244", "#f38ba8"
    ]),
    "catppuccin-latte": theme([
        "#e6e9ef", "#eff1f5", "#ccd0da", "#4c4f69", "#8c8fa1",
        "#ea76cb", "#b7bdf8", "#f4b8e4", "#4c4f69", "#ccd0da", "#d20f39"
    ]),
    "nord": theme([
        "#2e3440", "#3b4252", "#434c5e", "#d8dee9", "#7b88a1",
        "#88c0d0", "#88c0d0", "#b48ead", "#2e3440", "#3b4252", "#bf616a"
    ]),
    "gruvbox": theme([
        "#282828", "#32302f", "#3c3836", "#ebdbb2", "#928374",
        "#d79921", "#d79921", "#fe8019", "#282828", "#3c3836", "#cc241d"
    ]),
    "tokyonight": theme([
        "#1a1b26", "#16161e", "#292e42", "#c0caf5", "#565f89",
        "#bb9af7", "#7aa2f7", "#bb9af7", "#1a1b26", "#292e42", "#f7768e"
    ]),
    "rose-pine": theme([
        "#191724", "#1f1d2e", "#26233a", "#e0def4", "#6e6a86",
        "#ebbcba", "#c4a7e7", "#ebbcba", "#191724", "#26233a", "#eb6f92"
    ]),
    "dracula": theme([
        "#282a36", "#21222c", "#44475a", "#f8f8f2", "#6272a4",
        "#bd93f9", "#bd93f9", "#ff79c6", "#282a36", "#44475a", "#ff5555"
    ])
};

var DEFAULTS = {
    theme: "catppuccin-mocha",

    window: {
        width: 560,
        radius: 12,
        padding: 20,
        gap: 16,
        border_width: 1,
        opacity: 0.97,
        dim: 0.0,
        offset_y: 0,
        monitor: ""
    },

    search: {
        height: 40,
        radius: 10,
        border_width: 2,
        padding_x: 12,
        placeholder: "Search...",
        icon: "\uf002",
        icon_size: 16
    },

    list: {
        visible_rows: 6.5,
        row_height: 36,
        row_gap: 2,
        row_radius: 10,
        padding_x: 8,
        icon_size: 26,
        icon_gap: 12,
        show_icons: true,
        show_description: false,
        shrink_to_fit: true,
        scrollbar: true,
        scrollbar_gap: 8,
        empty_text: "No results"
    },

    font: {
        family: "",
        size: 15,
        weight: "normal",
        selected_weight: "normal",
        italic: false,
        letter_spacing: 0
    },

    behavior: {
        mode: "oneshot",
        terminal: "foot",
        terminal_exec_flag: "-e",
        remember_usage: true,
        max_results: 200,
        command_prefix: ">",
        close_on_click_outside: true,
        wrap: true,
        hover_select: true
    },

    animation: {
        enabled: true,
        duration_ms: 120,
        resize_ms: 180
    },

    colors: {
        bg: "",
        surface: "",
        border: "",
        fg: "",
        muted: "",
        accent: "",
        selected_from: "",
        selected_to: "",
        selected_fg: "",
        hover: "",
        urgent: ""
    }
};

function isObj(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseToml(src) {
    var i = 0, n = src.length;
    var root = {}, cur = root;

    function lineNo() {
        var c = 1;
        for (var j = 0; j < i && j < n; j++) {
            if (src.charAt(j) === "\n") c++;
        }
        return c;
    }

    function fail(m) {
        throw new Error("TOML line " + lineNo() + ": " + m);
    }

    function skipWs() {
        while (i < n) {
            var c = src.charAt(i);
            if (c === " " || c === "\t") i++;
            else break;
        }
    }

    function skipComment() {
        if (src.charAt(i) === "#") {
            while (i < n && src.charAt(i) !== "\n") i++;
        }
    }

    function skipAll() {
        while (i < n) {
            var c = src.charAt(i);
            if (c === " " || c === "\t" || c === "\n" || c === "\r") {
                i++;
            } else if (c === "#") {
                skipComment();
            } else {
                break;
            }
        }
    }

    function parseString() {
        var q = src.charAt(i++), out = "";

        if (q === "'") {
            var s = i;

            while (i < n && src.charAt(i) !== "'" && src.charAt(i) !== "\n") {
                i++;
            }

            if (src.charAt(i) !== "'") fail("unterminated string");

            out = src.substring(s, i);
            i++;
            return out;
        }

        while (i < n) {
            var c = src.charAt(i++);

            if (c === '"') return out;
            if (c === "\n") fail("unterminated string");

            if (c === "\\") {
                var e = src.charAt(i++);

                if (e === "n") out += "\n";
                else if (e === "t") out += "\t";
                else if (e === "r") out += "\r";
                else if (e === "b") out += "\b";
                else if (e === "f") out += "\f";
                else if (e === '"') out += '"';
                else if (e === "\\") out += "\\";
                else if (e === "u" || e === "U") {
                    var len = e === "u" ? 4 : 8;
                    var hex = src.substr(i, len);

                    if (hex.length !== len || !/^[0-9a-fA-F]+$/.test(hex)) {
                        fail("bad unicode escape");
                    }

                    out += String.fromCodePoint(parseInt(hex, 16));
                    i += len;
                } else {
                    fail("bad escape \\" + e);
                }
            } else {
                out += c;
            }
        }

        fail("unterminated string");
    }

    function parseKey() {
        var parts = [];

        for (;;) {
            skipWs();

            var c = src.charAt(i);

            if (c === '"' || c === "'") {
                parts.push(parseString());
            } else {
                var s = i;

                while (i < n && /[A-Za-z0-9_\-]/.test(src.charAt(i))) {
                    i++;
                }

                if (i === s) fail("expected a key");

                parts.push(src.substring(s, i));
            }

            skipWs();

            if (src.charAt(i) === ".") {
                i++;
                continue;
            }

            return parts;
        }
    }

    function setPath(obj, parts, val) {
        for (var j = 0; j < parts.length - 1; j++) {
            var p = parts[j];

            if (!isObj(obj[p])) obj[p] = {};

            obj = obj[p];
        }

        obj[parts[parts.length - 1]] = val;
    }

    function parseValue() {
        skipWs();

        var c = src.charAt(i), d;

        if (c === '"' || c === "'") return parseString();

        if (c === "[") {
            i++;

            var arr = [];

            for (;;) {
                skipAll();

                if (src.charAt(i) === "]") {
                    i++;
                    return arr;
                }

                arr.push(parseValue());
                skipAll();

                d = src.charAt(i);

                if (d === ",") i++;
                else if (d === "]") {
                    i++;
                    return arr;
                } else {
                    fail("expected , or ] in array");
                }
            }
        }

        if (c === "{") {
            i++;

            var obj = {};

            for (;;) {
                skipWs();

                if (src.charAt(i) === "}") {
                    i++;
                    return obj;
                }

                var k = parseKey();

                skipWs();

                if (src.charAt(i) !== "=") fail("expected = in inline table");

                i++;
                setPath(obj, k, parseValue());
                skipWs();

                d = src.charAt(i);

                if (d === ",") i++;
                else if (d === "}") {
                    i++;
                    return obj;
                } else {
                    fail("expected , or } in inline table");
                }
            }
        }

        var s = i;

        while (i < n && !/[\s,\]\}#]/.test(src.charAt(i))) {
            i++;
        }

        var tok = src.substring(s, i);

        if (tok === "true") return true;
        if (tok === "false") return false;

        var t = tok.replace(/_/g, "");

        if (/^[+-]?\d+$/.test(t)) return parseInt(t, 10);
        if (/^0x[0-9a-fA-F]+$/.test(t)) return parseInt(t, 16);

        if (/^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/.test(t)) {
            return parseFloat(t);
        }

        fail("invalid value '" + tok + "' (strings need quotes)");
    }

    for (;;) {
        skipAll();

        if (i >= n) break;

        if (src.charAt(i) === "[") {
            if (src.charAt(i + 1) === "[") {
                fail("[[array tables]] are not supported");
            }

            i++;

            var path = parseKey();

            skipWs();

            if (src.charAt(i) !== "]") fail("expected ]");

            i++;
            cur = root;

            for (var j = 0; j < path.length; j++) {
                if (!isObj(cur[path[j]])) cur[path[j]] = {};
                cur = cur[path[j]];
            }
        } else {
            var key = parseKey();

            skipWs();

            if (src.charAt(i) !== "=") fail("expected = after key");

            i++;
            setPath(cur, key, parseValue());
        }

        skipWs();
        skipComment();

        var e = src.charAt(i);

        if (i < n && e !== "\n" && e !== "\r") {
            fail("unexpected text after value");
        }
    }

    return root;
}

function merge(dst, src, path, warns) {
    for (var k in src) {
        var p = path ? path + "." + k : k;

        if (!(k in dst)) {
            warns.push("unknown key '" + p + "' (ignored)");
            continue;
        }

        var d = dst[k], v = src[k];

        if (isObj(d)) {
            if (isObj(v)) merge(d, v, p, warns);
            else warns.push("'" + p + "' must be a [table]");
        } else if (k === "weight" || k === "selected_weight") {
            if (typeof v === "string" || typeof v === "number") {
                dst[k] = v;
            } else {
                warns.push("'" + p + "' must be a string or number");
            }
        } else if (Array.isArray(d)) {
            if (Array.isArray(v)) dst[k] = v;
            else warns.push("'" + p + "' must be a list");
        } else if (typeof d === typeof v) {
            dst[k] = v;
        } else {
            warns.push("'" + p + "' should be a " + typeof d + ", got " + typeof v);
        }
    }
}

function clamp(o, k, lo, hi) {
    if (o[k] < lo) o[k] = lo;
    if (o[k] > hi) o[k] = hi;
}

var WEIGHTS = {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    regular: 400,
    medium: 500,
    semibold: 600,
    demibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900
};

function weightNum(v, key, warns) {
    if (typeof v === "number") {
        return Math.max(1, Math.min(1000, Math.round(v)));
    }

    var w = WEIGHTS[String(v).toLowerCase()];

    if (w === undefined) {
        warns.push(key + " = '" + v + "' is not a font weight (using normal)");
        return 400;
    }

    return w;
}

function validate(c, w) {
    if (!THEMES[c.theme]) {
        w.push(
            "theme '" + c.theme + "' unknown, use one of: " +
            Object.keys(THEMES).join(", ")
        );

        c.theme = DEFAULTS.theme;
    }

    if (c.behavior.mode !== "oneshot" && c.behavior.mode !== "daemon") {
        w.push('behavior.mode must be "oneshot" or "daemon"');
        c.behavior.mode = "oneshot";
    }

    clamp(c.window, "width", 200, 4000);
    clamp(c.window, "opacity", 0, 1);
    clamp(c.window, "dim", 0, 1);
    clamp(c.window, "radius", 0, 200);
    clamp(c.window, "padding", 0, 200);
    clamp(c.window, "gap", 0, 200);

    clamp(c.search, "height", 16, 200);

    clamp(c.list, "visible_rows", 1, 30);
    clamp(c.list, "row_height", 16, 200);
    clamp(c.list, "row_gap", 0, 50);
    clamp(c.list, "icon_size", 8, 128);

    clamp(c.font, "size", 6, 80);
    clamp(c.behavior, "max_results", 1, 5000);
    clamp(c.animation, "duration_ms", 0, 2000);
    clamp(c.animation, "resize_ms", 0, 2000);

    var re = /^(#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|[a-zA-Z]+)$/;

    for (var k in c.colors) {
        if (c.colors[k] !== "" && !re.test(c.colors[k])) {
            w.push("colors." + k + " = '" + c.colors[k] + "' is not a valid color");
            c.colors[k] = "";
        }
    }

    c.font.weight_n = weightNum(c.font.weight, "font.weight", w);
    c.font.selected_weight_n = weightNum(c.font.selected_weight, "font.selected_weight", w);
}

function load(text) {
    var warns = [], user = {}, fatal = false;

    if (text && String(text).trim() !== "") {
        try {
            user = parseToml(String(text));
        } catch (e) {
            warns.push(e.message);
            user = {};
            fatal = true;
        }
    }

    var conf = JSON.parse(JSON.stringify(DEFAULTS));

    merge(conf, user, "", warns);
    validate(conf, warns);

    var pal = {}, base = THEMES[conf.theme];

    for (var i = 0; i < PALETTE_KEYS.length; i++) {
        var k = PALETTE_KEYS[i];
        pal[k] = conf.colors[k] !== "" ? conf.colors[k] : base[k];
    }

    return {
        conf: conf,
        pal: pal,
        warnings: warns,
        fatal: fatal
    };
}
