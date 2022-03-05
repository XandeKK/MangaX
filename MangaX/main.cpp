#include <Python.h>
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <qqml.h>
#include <qqmlcontext.h>

#include "src/database.h"

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);

    Database db;
    db.openDatabase();
    db.createTable();

    char filename[] = "/home/alexandre/Documents/GitHub/MangaX/MangaX/src/python/scraping.py";
    FILE *fp;

    Py_Initialize();

    fp = _Py_fopen(filename, "r");
    PyRun_SimpleFile(fp, filename);

    Py_Finalize();

    QQmlApplicationEngine engine;
    const QUrl url("qrc:/qml/main.qml");
    engine.rootContext()->setContextProperty( "_database", &db );
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreated,
                     &app, [url](QObject *obj, const QUrl &objUrl) {
        if (!obj && url == objUrl)
            QCoreApplication::exit(-1);
    }, Qt::QueuedConnection);
    engine.load(url);

    return app.exec();
}
