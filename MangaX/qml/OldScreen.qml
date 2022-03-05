import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Controls.Material 2.15

Item {
    anchors.fill: parent

    Rectangle {
        id: rectTop
        color: "#00000000"
        width: parent.width
        height: 25
    }

    NumberAnimation {
        id: anim
        target: rectButtonAdd
        property: "name"
        duration: 200
        easing.type: Easing.InOutQuad
    }

    ListView {
        id: listView
        anchors.top: rectTop.bottom
        anchors.bottom: parent.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        boundsMovement: Flickable.StopAtBounds
        interactive: true
        spacing: 4
        onFlickingChanged: {
            if(listView.atYBeginning == false && listView.atYEnd == true){
                anim.property = "anchors.bottomMargin"
                anim.to = rectButtonAdd.bottomMarginButtonAdd + 60
                anim.running = true
            }else{
                anim.property = "anchors.bottomMargin"
                anim.to = rectButtonAdd.bottomMarginButtonAdd
                anim.running = true
            }
        }

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
                    color: "white"
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
                    width: parent.width * 60 / 100
                    font.pointSize: 9 * dip
                    text: "Site: " + site
                    color: "white"
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
                    color: "white"
                    wrapMode: Text.WordWrap
                    clip: true
                }

                MouseArea {
                    id: mouseArea
                    anchors.fill: parent
                }

                Image {
                    id: optionItem
                    source: "qrc:/Assets/threeDotsWhite.png"
                    anchors.left: textManga.right
                    anchors.leftMargin: parent.height * 2.5 / 100
                    anchors.top: parent.top
                    anchors.topMargin: parent.height * 10 / 100
                    height: 20
                    width: 20
                    fillMode: Image.PreserveAspectFit

                    Menu {
                        id: menu
                        MenuItem {
                            text: "edit"
                            onTriggered: console.log("edit")
                        }
                        MenuItem {
                            text: "delete"
                            onTriggered: console.log("delete")
                        }
                    }

                    MouseArea {
                        anchors.fill: parent
                        onClicked: menu.open()
                    }
                }

                Rectangle {
                    anchors.fill: parent
                    color: mouseArea.pressed ? "#33000000" : "#00000000"
                }
            }

        }

        delegate: myDelegate

        model: ListModel{
            id: listModel
            ListElement {name: "One piece"; site: "mangalivre"; cap: "1000"}
            ListElement {name: "Naruto"; site: "UnionManga"; cap: "700"}
            ListElement {name: "One piece"; site: "mangalivre"; cap: "1000"}
            ListElement {name: "Naruto"; site: "UnionManga"; cap: "700"}
            ListElement {name: "One piece"; site: "mangalivre"; cap: "1000"}
            ListElement {name: "Naruto"; site: "UnionManga"; cap: "700"}
            ListElement {name: "One piece"; site: "mangalivre"; cap: "1000"}
            ListElement {name: "Naruto"; site: "UnionManga"; cap: "700"}
            ListElement {name: "One piece"; site: "mangalivre"; cap: "1000"}
            ListElement {name: "Naruto"; site: "UnionManga"; cap: "700"}
            ListElement {name: "One piece"; site: "mangalivre"; cap: "1000"}
            ListElement {name: "Naruto"; site: "UnionManga"; cap: "700"}

        }
    }
}
