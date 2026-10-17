import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import Quickshell.Widgets
import "config.js" as Config
import "search.js" as Search

ShellRoot {
    id: root

    readonly property string home: Quickshell.env("HOME") || ""
    readonly property string cfgHome: Quickshell.env("XDG_CONFIG_HOME") || (home + "/.config")
    readonly property string stateHome: Quickshell.env("XDG_STATE_HOME") || (home + "/.local/state")
    readonly property string configPath: Quickshell.env("ROSEMENU_CONFIG") || (cfgHome + "/rosemenu/config.toml")
    readonly property string historyDir: stateHome + "/rosemenu"
    readonly property string historyPath: historyDir + "/history.json"

    property var loaded: Config.load("")
    property bool hasGoodConfig: false

    readonly property var conf: loaded.conf
    readonly property var pal: loaded.pal
    readonly property var warnings: loaded.warnings

    function applyConfig(text) {
        var r = Config.load(text);

        if (r.fatal && hasGoodConfig) {
            r = {
                conf: loaded.conf,
                pal: loaded.pal,
                warnings: r.warnings,
                fatal: true
            };
        } else if (!r.fatal) {
            hasGoodConfig = true;
        }

        loaded = r;
    }

    FileView {
        id: cfgFile
        path: root.configPath
        blockLoading: true
        watchChanges: true
        printErrors: false

        onFileChanged: reload()
        onLoaded: root.applyConfig(text())
        onLoadFailed: root.applyConfig("")
    }

    property var usage: ({})

    FileView {
        id: histFile
        path: root.historyPath
        blockLoading: true
        printErrors: false

        onLoaded: {
            try {
                root.usage = JSON.parse(text());
            } catch (e) {
                root.usage = {};
            }
        }
    }

    Process {
        command: ["mkdir", "-p", root.historyDir]
        running: true
    }

    function bump(id) {
        if (!conf.behavior.remember_usage || !id) return;

        var u = Object.assign({}, usage);
        u[id] = (u[id] || 0) + 1;

        usage = u;
        histFile.setText(JSON.stringify(u));
    }

    property bool shown: false
    property string query: ""
    property int cur: 0

    property var records: Search.buildRecords(DesktopEntries.applications.values)

    property var results: {
        var p = conf.behavior.command_prefix;

        if (p !== "" && query.indexOf(p) === 0) {
            var c = query.substring(p.length).trim();

            return c === ""
                ? []
                : [{
                    name: "Run: " + c,
                    comment: "",
                    icon: "utilities-terminal",
                    command: c
                }];
        }

        return Search.run(
            records,
            query,
            usage,
            conf.behavior.max_results
        );
    }

    onResultsChanged: cur = 0

    readonly property real pitch: conf.list.row_height + conf.list.row_gap

    readonly property real fullListH:
        conf.list.visible_rows * pitch - conf.list.row_gap

    readonly property real listHeight: {
        var content = results.length * pitch - conf.list.row_gap;

        return conf.list.shrink_to_fit
            ? Math.max(0, Math.min(fullListH, content))
            : fullListH;
    }

    readonly property real fullCardH:
        conf.window.padding * 2
        + conf.search.height
        + conf.window.gap
        + fullListH

    readonly property string fontFamily:
        conf.font.family !== ""
            ? conf.font.family
            : Qt.application.font.family

    function open(reload) {
        if (reload) cfgFile.reload();

        input.text = "";
        query = "";
        cur = 0;
        shown = true;

        if (conf.animation.enabled) appear.restart();

        Qt.callLater(function() {
            input.forceActiveFocus();
        });
    }

    function close() {
        shown = false;

        if (conf.behavior.mode !== "daemon") {
            quitTimer.start();
        }
    }

    Timer {
        id: quitTimer
        interval: 180
        onTriggered: Qt.quit()
    }

    function launch(rec) {
        if (!rec) return;

        if (rec.command) {
            Quickshell.execDetached(["sh", "-c", rec.command]);
        } else {
            var e = rec.entry;

            if (e.runInTerminal) {
                var term = conf.behavior.terminal
                    .split(/\s+/)
                    .filter(function(s) {
                        return s !== "";
                    });

                Quickshell.execDetached(
                    term
                    .concat([conf.behavior.terminal_exec_flag])
                    .concat(e.command)
                );
            } else {
                e.execute();
            }

            bump(rec.id);
        }

        close();
    }

    function move(d) {
        var n = results.length;

        if (n === 0) return;

        var t = cur + d;

        if (conf.behavior.wrap && Math.abs(d) === 1) {
            t = (t + n) % n;
        } else {
            t = Math.max(0, Math.min(n - 1, t));
        }

        cur = t;
    }

    function handleKey(ev) {
        var ctrl = (ev.modifiers & Qt.ControlModifier) !== 0;
        var rows = Math.max(1, Math.floor(conf.list.visible_rows));

        if (ev.key === Qt.Key_Escape) {
            close();
        } else if (ev.key === Qt.Key_Return || ev.key === Qt.Key_Enter) {
            launch(results[cur]);
        } else if (
            ev.key === Qt.Key_Down
            || ev.key === Qt.Key_Tab
            || (ctrl && (ev.key === Qt.Key_J || ev.key === Qt.Key_N))
        ) {
            move(1);
        } else if (
            ev.key === Qt.Key_Up
            || ev.key === Qt.Key_Backtab
            || (ctrl && (ev.key === Qt.Key_K || ev.key === Qt.Key_P))
        ) {
            move(-1);
        } else if (ev.key === Qt.Key_PageDown) {
            move(rows);
        } else if (ev.key === Qt.Key_PageUp) {
            move(-rows);
        } else if (ctrl && ev.key === Qt.Key_U) {
            input.text = "";
        } else {
            return;
        }

        ev.accepted = true;
    }

    function pickScreen() {
        var s = Quickshell.screens;

        for (var i = 0; i < s.length; i++) {
            if (s[i].name === conf.window.monitor) return s[i];
        }

        return s[0];
    }

    IpcHandler {
        target: "rosemenu"

        function toggle(): void {
            if (root.shown) root.close();
            else root.open(true);
        }

        function open(): void {
            root.open(true);
        }

        function close(): void {
            root.close();
        }
    }

    Component.onCompleted: {
        try {
            applyConfig(cfgFile.text());
        } catch (e) {
            applyConfig("");
        }

        try {
            usage = JSON.parse(histFile.text());
        } catch (e2) {
        }

        if (conf.behavior.mode !== "daemon") open(false);
    }

    PanelWindow {
        id: win

        visible: root.shown
        color: "transparent"

        anchors {
            top: true
            bottom: true
            left: true
            right: true
        }

        exclusionMode: ExclusionMode.Ignore
        WlrLayershell.layer: WlrLayer.Overlay
        WlrLayershell.namespace: "rosemenu"
        WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive

        Binding {
            target: win
            property: "screen"
            value: root.pickScreen()
            when: root.conf.window.monitor !== ""
        }

        Rectangle {
            anchors.fill: parent
            color: "black"
            opacity: root.conf.window.dim
            visible: opacity > 0
        }

        MouseArea {
            anchors.fill: parent

            onClicked: {
                if (root.conf.behavior.close_on_click_outside) {
                    root.close();
                }
            }
        }

        Rectangle {
            id: card

            width: Math.min(root.conf.window.width, win.width - 40)
            height: col.height + root.conf.window.padding * 2
            x: Math.round((win.width - width) / 2)
            y: Math.round(
                (win.height - root.fullCardH) / 2
                + root.conf.window.offset_y
            )

            radius: root.conf.window.radius
            color: Qt.alpha(root.pal.bg, root.conf.window.opacity)

            border.width: root.conf.window.border_width
            border.color: root.pal.border

            Behavior on width {
                enabled: root.conf.animation.enabled
                    && root.conf.animation.resize_ms > 0

                NumberAnimation {
                    duration: root.conf.animation.resize_ms
                    easing.type: Easing.OutCubic
                }
            }

            MouseArea {
                anchors.fill: parent
            }

            ParallelAnimation {
                id: appear

                NumberAnimation {
                    target: card
                    property: "opacity"
                    from: 0
                    to: 1
                    duration: root.conf.animation.duration_ms
                    easing.type: Easing.OutCubic
                }

                NumberAnimation {
                    target: card
                    property: "scale"
                    from: 0.97
                    to: 1
                    duration: root.conf.animation.duration_ms
                    easing.type: Easing.OutCubic
                }
            }

            Column {
                id: col

                x: root.conf.window.padding
                y: root.conf.window.padding

                width: card.width - root.conf.window.padding * 2
                spacing: root.conf.window.gap

                Rectangle {
                    width: parent.width
                    height: root.conf.search.height
                    radius: root.conf.search.radius

                    color: root.pal.surface

                    border.width: root.conf.search.border_width
                    border.color: root.pal.accent

                    Text {
                        id: sIcon

                        anchors.left: parent.left
                        anchors.leftMargin: root.conf.search.padding_x
                        anchors.verticalCenter: parent.verticalCenter

                        text: root.conf.search.icon
                        color: root.pal.selected_from

                        font.family: root.fontFamily
                        font.pixelSize: root.conf.search.icon_size
                    }

                    TextInput {
                        id: input

                        anchors.left: sIcon.right
                        anchors.leftMargin: 10
                        anchors.right: parent.right
                        anchors.rightMargin: root.conf.search.padding_x
                        anchors.verticalCenter: parent.verticalCenter

                        clip: true
                        focus: true

                        color: root.pal.fg
                        selectionColor: root.pal.selected_from
                        selectedTextColor: root.pal.selected_fg

                        font.family: root.fontFamily
                        font.pixelSize: root.conf.font.size
                        font.weight: root.conf.font.weight_n
                        font.italic: root.conf.font.italic
                        font.letterSpacing: root.conf.font.letter_spacing

                        onTextChanged: root.query = text

                        Keys.onPressed: function(event) {
                            root.handleKey(event);
                        }

                        Text {
                            anchors.fill: parent
                            visible: input.text === ""

                            verticalAlignment: Text.AlignVCenter
                            text: root.conf.search.placeholder
                            color: root.pal.muted
                            font: input.font
                        }
                    }
                }

                Item {
                    visible: root.results.length > 0
                    width: parent.width
                    height: root.listHeight

                    Behavior on height {
                        enabled: root.conf.animation.enabled
                            && root.conf.animation.resize_ms > 0

                        NumberAnimation {
                            duration: root.conf.animation.resize_ms
                            easing.type: Easing.OutCubic
                        }
                    }

                    ListView {
                        id: list

                        anchors.fill: parent
                        clip: true
                        model: root.results
                        currentIndex: root.cur
                        spacing: root.conf.list.row_gap
                        boundsBehavior: Flickable.StopAtBounds
                        highlightMoveDuration: 0

                        onCurrentIndexChanged: {
                            positionViewAtIndex(
                                currentIndex,
                                ListView.Contain
                            );
                        }

                        delegate: Item {
                            id: row

                            required property var modelData
                            required property int index

                            readonly property bool sel:
                                ListView.isCurrentItem

                            width: list.width
                            height: root.conf.list.row_height

                            Rectangle {
                                anchors.fill: parent
                                radius: root.conf.list.row_radius
                                color: root.pal.hover
                                visible: ma.containsMouse && !row.sel
                            }

                            Rectangle {
                                anchors.fill: parent
                                radius: root.conf.list.row_radius
                                visible: row.sel

                                gradient: Gradient {
                                    orientation: Gradient.Horizontal

                                    GradientStop {
                                        position: 0.0
                                        color: root.pal.selected_from
                                    }

                                    GradientStop {
                                        position: 1.0
                                        color: root.pal.selected_to
                                    }
                                }
                            }

                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: root.conf.list.padding_x
                                anchors.rightMargin: root.conf.list.padding_x
                                spacing: root.conf.list.icon_gap

                                IconImage {
                                    visible: root.conf.list.show_icons

                                    implicitSize: root.conf.list.icon_size

                                    Layout.preferredWidth:
                                        root.conf.list.icon_size

                                    Layout.preferredHeight:
                                        root.conf.list.icon_size

                                    source: Quickshell.iconPath(
                                        row.modelData.icon
                                            || "application-x-executable",
                                        "application-x-executable"
                                    )
                                }

                                Text {
                                    Layout.fillWidth: !desc.visible

                                    Layout.maximumWidth: desc.visible
                                        ? row.width * 0.6
                                        : row.width

                                    text: row.modelData.name
                                    elide: Text.ElideRight

                                    color: row.sel
                                        ? root.pal.selected_fg
                                        : root.pal.fg

                                    font.family: root.fontFamily
                                    font.pixelSize: root.conf.font.size

                                    font.weight: row.sel
                                        ? root.conf.font.selected_weight_n
                                        : root.conf.font.weight_n

                                    font.italic: root.conf.font.italic
                                    font.letterSpacing:
                                        root.conf.font.letter_spacing
                                }

                                Text {
                                    id: desc

                                    visible:
                                        root.conf.list.show_description
                                        && text !== ""

                                    Layout.fillWidth: true
                                    text: row.modelData.comment || ""

                                    elide: Text.ElideRight
                                    horizontalAlignment: Text.AlignRight

                                    color: row.sel
                                        ? root.pal.selected_fg
                                        : root.pal.muted

                                    opacity: 0.75
                                    font.family: root.fontFamily

                                    font.pixelSize: Math.max(
                                        8,
                                        root.conf.font.size - 2
                                    )
                                }
                            }

                            MouseArea {
                                id: ma

                                anchors.fill: parent
                                hoverEnabled: true

                                onPositionChanged: {
                                    if (root.conf.behavior.hover_select) {
                                        root.cur = row.index;
                                    }
                                }

                                onClicked: root.launch(row.modelData)
                            }
                        }
                    }

                    Rectangle {
                        visible: root.conf.list.scrollbar
                            && list.visibleArea.heightRatio < 1

                        x: parent.width + Math.max(
                            0,
                            Math.min(
                                root.conf.list.scrollbar_gap,
                                root.conf.window.padding - width
                            )
                        )

                        y: list.visibleArea.yPosition * parent.height

                        width: 3

                        height: Math.max(
                            16,
                            list.visibleArea.heightRatio * parent.height
                        )

                        radius: 2
                        color: root.pal.muted
                        opacity: 0.5
                    }
                }

                Item {
                    visible: root.results.length === 0
                    width: parent.width
                    height: root.conf.list.row_height

                    Text {
                        anchors.centerIn: parent

                        text: root.conf.list.empty_text
                        color: root.pal.muted

                        font.family: root.fontFamily
                        font.pixelSize: root.conf.font.size
                    }
                }

                Text {
                    visible: root.warnings.length > 0
                    width: parent.width

                    maximumLineCount: 1
                    elide: Text.ElideRight

                    color: root.pal.urgent
                    font.family: root.fontFamily

                    font.pixelSize: Math.max(
                        8,
                        root.conf.font.size - 3
                    )

                    text: root.warnings.length > 0
                        ? "config: " + root.warnings[0]
                            + (
                                root.warnings.length > 1
                                    ? "  (+"
                                        + (root.warnings.length - 1)
                                        + " more)"
                                    : ""
                            )
                        : ""
                }
            }
        }
    }
}