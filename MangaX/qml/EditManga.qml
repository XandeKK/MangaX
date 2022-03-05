import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Controls.Material 2.15
import QtQuick.Layouts 1.15

Item {

    Action {
        shortcut: "ESC"
        onTriggered: stack.pop()
    }

    ToolBar {
        id: toolBar
        height: parent.height * 6 / 100
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top


        background: Rectangle {
            color: "#00ffffff"
        }

        RowLayout {
            anchors.fill: parent
            id: rowLayout
            ToolButton {
                id: toolButtonBack
                Layout.fillWidth: false
                onClicked:{
                    stack.pop()
                }
                text: qsTr("<")
                font.pixelSize: 20

                contentItem: Text {
                    text: toolButtonBack.text
                    font: toolButtonBack.font
                    opacity: enabled ? 1.0 : 0.3
                    color: "white"
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    elide: Text.ElideRight
                }

                background: Rectangle {
                    implicitWidth: 40
                    implicitHeight: 40
                    color: toolButtonBack.pressed ? "#33000000" : "#00000000" // Qt.darker("#33333333", toolButtonBack.enabled && (toolButtonBack.checked || toolButtonBack.highlighted) ? 1.5 : 1.0)
                    opacity: enabled ? 1 : 0.3
                    visible: toolButtonBack.down || (toolButtonBack.enabled && (toolButtonBack.checked || toolButtonBack.highlighted))
                }
            }
        }
    }

    Column {
        id: column1
        width: 200
        height: 400
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: toolBar.bottom
        anchors.bottom: parent.bottom
        spacing: parent.height * 2.5 / 100
        anchors.rightMargin: parent.width * 5 / 100
        anchors.leftMargin: parent.width * 5 /100
        anchors.topMargin: parent.height * 5 / 100
        anchors.bottomMargin: 0


        Rectangle {
            id: rectManga
            width: parent.width
            height: parent.height * 10 / 100
            color: backgroundColorInput
            radius: 20
            focus: false

            TextInput {
                id: inputManga
                text: qsTr(arrayManga["name"])
                anchors.fill: parent
                font.pointSize: 9 * dip
                horizontalAlignment: Text.AlignLeft
                verticalAlignment: Text.AlignVCenter
                wrapMode: Text.NoWrap
                clip: true
                anchors.rightMargin: parent.width * 2.5 / 100
                anchors.leftMargin: parent.width * 4 /100
                color: "white"
                selectionColor: "#2196F3"
                selectByMouse: true

                KeyNavigation.tab: inputUrl

                Keys.onReturnPressed: {
                    inputManga.focus = false
                    inputUrl.focus = true
                }

                Text {
                    id: textManga
                    color: "#9a9a9a"
                    text: qsTr("Name")
                    anchors.fill: parent
                    font.pointSize: 9 * dip
                    horizontalAlignment: Text.AlignLeft
                    verticalAlignment: Text.AlignVCenter
                    visible: !inputManga.text && !inputManga.activeFocus
                }
            }
        }

        Rectangle {
            id: rectUrl
            width: parent.width
            height: parent.height * 10 / 100
            color: backgroundColorInput
            radius: 20
            focus: false

            TextInput {
                id: inputUrl
                text: qsTr(arrayManga["url"])
                anchors.fill: parent
                font.pointSize: 9 * dip
                horizontalAlignment: Text.AlignLeft
                verticalAlignment: Text.AlignVCenter
                wrapMode: Text.NoWrap
                clip: true
                anchors.rightMargin: parent.width * 2.5 / 100
                anchors.leftMargin: parent.width * 4 /100
                color: "white"
                selectionColor: "#2196F3"
                selectByMouse: true

                KeyNavigation.tab: inputChapter

                Keys.onReturnPressed: {
                    inputUrl.focus = false
                    inputChapter.focus = true
                }

                Text {
                    id: textUrl
                    color: "#9a9a9a"
                    text: qsTr("Url")
                    anchors.fill: parent
                    font.pointSize: 9 * dip
                    horizontalAlignment: Text.AlignLeft
                    verticalAlignment: Text.AlignVCenter
                    visible: !inputUrl.text && !inputUrl.activeFocus
                }
            }
        }

        Rectangle {
            id: rectChapter
            width: parent.width
            height: parent.height * 10 / 100
            color: backgroundColorInput
            radius: 20

            TextInput {
                id: inputChapter
                text: qsTr(arrayManga["cap"])
                anchors.fill: parent
                font.pointSize: 9 * dip
                horizontalAlignment: Text.AlignLeft
                verticalAlignment: Text.AlignVCenter
                wrapMode: Text.NoWrap
                inputMethodHints: Qt.ImhDigitsOnly
                clip: true
                anchors.rightMargin: parent.width * 15 / 100
                color: "white"
                selectionColor: "#2196F3"
                selectByMouse: true

                Text {
                    id: textChapter
                    visible: !inputChapter.text && !inputChapter.activeFocus
                    color: "#9a9a9a"
                    text: qsTr("Chapter")
                    anchors.fill: parent
                    font.pointSize: 9 * dip
                    horizontalAlignment: Text.AlignLeft
                    verticalAlignment: Text.AlignVCenter
                }
                anchors.leftMargin: parent.width * 4 /100
            }
        }

}
    Rectangle {
        id: rectButton
        anchors.bottom: parent.bottom
        anchors.bottomMargin: parent.height * 2.5 / 100
        anchors.right: parent.right
        anchors.rightMargin: parent.width * 5 / 100
        width: parent.width * 40 / 100
        height: 50
        color: "#00000000"

        Button {
            id: button
            anchors.fill: parent
            onClicked:{
                if(inputManga.text != "" && inputUrl.text != "" && inputChapter.text != ""){
//                    _database.addManga(inputManga.text, inputUrl.text, inputChapter.text)
//                    stack.pop() // Colocar um aviso que a operação deu certo.
                }
            }

            background: Rectangle{
                color: button.down ? "#3F51B5" : "#2196F3"
                radius: 15
            }
            Text {
                text: qsTr("Edit")
                anchors.verticalCenter: parent.verticalCenter
                font.pointSize: 9 * dip
                anchors.horizontalCenter: parent.horizontalCenter
                color: "white"
            }
        }
    }

}


