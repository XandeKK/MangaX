QT += quick
QT += sql
QT += core

SOURCES += \
        main.cpp \
        src/database.cpp \
        src/worker.cpp

#resources.files = qml/main.qml
#resources.prefix = /$${TARGET}
RESOURCES += qml.qrc

LIBS += -L"/usr/include/python3.8/" -lpython3.8
INCLUDEPATH += /usr/include/python3.8/
DEPENDPATH += /usr/include/python3.8/

# Additional import path used to resolve QML modules in Qt Creator's code model
QML_IMPORT_PATH =

# Additional import path used to resolve QML modules just for Qt Quick Designer
QML_DESIGNER_IMPORT_PATH =

# Default rules for deployment.
qnx: target.path = /tmp/$${TARGET}/bin
else: unix:!android: target.path = /opt/$${TARGET}/bin
!isEmpty(target.path): INSTALLS += target

HEADERS += \
    src/database.h \
    src/worker.h

DISTFILES += \
    src/python/scraping.py
