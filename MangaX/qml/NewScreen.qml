import QtQuick 2.15
import QtQuick.Controls 2.15

Item {
    anchors.fill: parent
    ListView {
        id: listView
        anchors.fill: parent
//        boundsMovement: Flickable.StopAtBounds
        interactive: true
        clip: true
        spacing: 10

        Component {
            id: myDelegate
            Item {
                y: 10
                height: 60
                width: listView.width
                Text {
                    id: textManga
                    anchors.top: parent.top
                    anchors.topMargin: parent.height * 2.5 / 100
                    anchors.left: parent.left
                    anchors.leftMargin: parent.width * 2.5 / 100
                    height: 20
                    width: parent.width * 90 / 100
                    font.pointSize: 9 * dip
                    text: "Manga: " + name
                    color: mouseArea.pressed ? "blue" : "white"
                    wrapMode: Text.WordWrap
                    clip: true
                }
                Text {
                    id: textSite
                    anchors.top: textManga.bottom
                    anchors.topMargin: parent.height * 2.5 / 100
                    anchors.left: parent.left
                    anchors.leftMargin: parent.width * 2.5 / 100
                    height: 20
                    width: parent.width * 70 / 100
                    font.pointSize: 9 * dip
                    text: "Site: " + site
                    color: mouseArea.pressed ? "blue" : "white"
                    wrapMode: Text.WordWrap
                    clip: true
                }
                Text {
                    id: textCap
                    anchors.top: textManga.bottom
                    anchors.topMargin: parent.height * 2.5 / 100
                    anchors.left: textSite.right
                    anchors.leftMargin: parent.width * 2.5 / 100
                    height: 20
                    width: parent.width * 20 / 100
                    font.pointSize: 9 * dip
                    text: "cap.: " + cap
                    color: mouseArea.pressed ? "blue" : "white"
                    wrapMode: Text.WordWrap
                    clip: true
                }
                Image {
                    id: optionItem
                    source: ""
                }

                MouseArea {
                    id: mouseArea
                    anchors.fill: parent
                }
                Rectangle {
                    anchors.bottom: parent.bottom
                    width: parent.width
                    height: 1
                }
            }

        }

        delegate: myDelegate

        model: ListModel{
            id: listModel
            ListElement {name: "One piece"; site: "mangalivre"; cap: "1000"}
            ListElement {name: "Naruto"; site: "UnionManga"; cap: "700"}
            ListElement {name: "Yoku Wakaranai keredo Isekai ni Tensei shiteita you desu"}
        }
    }
}
