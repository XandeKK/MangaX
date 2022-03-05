import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Controls.Material 2.15

ApplicationWindow {
    property var arrayManga
    id: root
    width: 460
    height: 640
    visible: true
    title: qsTr("MangaX")

    readonly property real dip: Screen.pixelDensity / (96 / 25.4)
    property string backgroundColorInput: "#4D4D4D"

    Material.theme: Material.Dark

    StackView {
        id: stack
        anchors.fill: parent
        initialItem: "qrc:/qml/MainScreen.qml"
    }
}
