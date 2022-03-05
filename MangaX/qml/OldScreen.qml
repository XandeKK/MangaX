import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Controls.Material 2.15

Item {
    anchors.fill: parent

    Timer {
        id: timer
        interval: 1000
        running: true
        repeat: true
        onTriggered: {
            let dataJson = _database.getListOldChapter()

            dataJson = JSON.parse(dataJson)

            if(dataJson.length > 0){
                running = false
                for(let i=0; i<dataJson.length; i++){
                    listModelOld.append({"name": dataJson[i]["name"],
                                         "url": dataJson[i]["url"],
                                         "currentChapter": dataJson[i]["currentChapter"],
                                         "newChapter": dataJson[i]["newChapter"]})
                }

            }
        }
    }

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
                    text: "Site: " + url
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
                    text: "Cap.: " + currentChapter
                    color: "white"
                    wrapMode: Text.WordWrap
                    clip: true
                }

                MouseArea {
                    id: mouseArea
                    anchors.fill: parent
                    onClicked: {
                        _database.openManga(url)
                    }
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
                            onTriggered: {
                                arrayManga = {
                                    "name": name,
                                    "url": url,
                                    "cap": currentChapter
                                }
                                stack.push("qrc:/qml/EditManga.qml")
                            }
                        }
                        MenuItem {
                            text: "delete"
                            onTriggered: {
                                _database.removeManga(name)
                                listModelOld.remove(index)
                            }
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
            id: listModelOld
            Component.onCompleted: varListModelOld = listModelOld
        }
    }
}
