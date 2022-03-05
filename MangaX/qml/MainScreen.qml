import QtQuick 2.15
import QtQuick.Controls 6.2
import QtQuick.Layouts 1.15
import QtQuick.Controls.Material 2.15

Page {
    SwipeView {
        id: swipeView
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.bottom: tabBar.top
        anchors.left: parent.left
        currentIndex: tabBar.currentIndex

        Loader {
            active: SwipeView.isCurrentItem
            sourceComponent: NewScreen {}
        }
        Loader {
            active: SwipeView.isCurrentItem
            sourceComponent: OldScreen {}
        }
    }

    Rectangle {
        id: rectButtonAdd
        width: 50
        height: 50
        anchors.bottom: parent.bottom
        anchors.bottomMargin: parent.height * 7.5 / 100
        anchors.right: parent.right
        anchors.rightMargin: parent.width * 4 / 100
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
            onClicked: stack.push("")
            anchors.fill: parent
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
