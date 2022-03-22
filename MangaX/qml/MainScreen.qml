import QtQuick 2.15
import QtQuick.Controls 6.2
import QtQuick.Layouts 1.15
import QtQuick.Controls.Material 2.15

Page {
    property var varListModelOld
    Component.onCompleted: {
        _worker.openPython()
    }

    Timer {
        id: timer
        running: true
        repeat: true
        interval: 100
        onTriggered: {
            if(_worker.getFinishedWebScraping()){
                console.log("Opa Terminou")
                running = false
                load.running = false
                _database.selectAllChapter()
            }
        }
    }

    BusyIndicator {
        id: load
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.verticalCenter: parent.verticalCenter
        running: true
        Material.accent: Material.Blue
    }

    Action {
        shortcut: "Ctrl+1"
        onTriggered: tabBar.currentIndex = 0
    }
    Action {
        shortcut: "Ctrl+2"
        onTriggered: tabBar.currentIndex = 1
    }
    Action {
        shortcut: "Ctrl+Tab"
        onTriggered: tabBar.currentIndex = tabBar.currentIndex == 0 ? 1 : 0
    }

    SwipeView {
        id: swipeView
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.bottom: tabBar.top
        anchors.left: parent.left
        currentIndex: tabBar.currentIndex

        Loader {
            sourceComponent: NewScreen {}
        }
        Loader {
            sourceComponent: OldScreen {}
        }
    }

    Rectangle {
        property int bottomMarginButtonAdd: parent.height * 7.5 / 100
        property int leftMarginButtonAdd: parent.width * 2.5 / 100 + 30

        id: rectButtonAdd
        width: 50
        height: 50
        anchors.bottom: parent.bottom
        anchors.bottomMargin: bottomMarginButtonAdd
        anchors.right: parent.right
        anchors.rightMargin: leftMarginButtonAdd
        color: mouseAreaAdd.pressed ? Material.color(Material.Blue, Material.Shade700) : Material.color(Material.Blue)
        radius: 50

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.verticalCenter: parent.verticalCenter
            font.pointSize: 20 * dip
            text: qsTr("+")
        }

        MouseArea {
            id: mouseAreaAdd
            onClicked: stack.push("qrc:/qml/AddManga.qml")
            anchors.fill: parent
        }
    }

    Rectangle {
        width: parent.width
        height: 5
        z: 1
        anchors.bottom: tabBar.top
        gradient: Gradient {
                GradientStop { position: 0.0; color: "#00000000" }
                GradientStop { position: 1.0; color: "#33000000" }
            }
    }

    TabBar {
        id: tabBar
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 0
        position: TabBar.Footer
        spacing: 0
        Material.accent: Material.Blue

//        background: Rectangle{
//            color: "white"
//        }

        height: parent.height * 6 / 100

        currentIndex: swipeView.currentIndex

        TabButton {
            height: parent.height
            anchors.verticalCenter: parent.verticalCenter
            background: Rectangle{
                color: tabBar.currentIndex === parent.TabBar.index ?  "#33000000" : "#00ffffff"
            }
            Text {
                id: home
                text: qsTr("New Chapter")
                anchors.verticalCenter: parent.verticalCenter
                anchors.horizontalCenter: parent.horizontalCenter
                color: "white"
            }
        }

        TabButton {
            height: parent.height
            anchors.verticalCenter: parent.verticalCenter
            background: Rectangle{
                color: tabBar.currentIndex === parent.TabBar.index ? "#33000000" : "#00ffffff"
            }
            Text {
                id: map
                text: qsTr("Old Chapter")
                anchors.verticalCenter: parent.verticalCenter
                anchors.horizontalCenter: parent.horizontalCenter
                color: "white"
            }
        }
    }
}
