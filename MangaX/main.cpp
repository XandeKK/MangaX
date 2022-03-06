#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <qqml.h>
#include <qqmlcontext.h>

#include "src/database.h"
#include "src/worker.h"

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);

    Database db;
    db.openDatabase();
    db.createTable();

    Worker worker;

    QQmlApplicationEngine engine;
    const QUrl url("qrc:/qml/main.qml");
    engine.rootContext()->setContextProperty( "_database", &db );
    engine.rootContext()->setContextProperty( "_worker", &worker );
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreated,
                     &app, [url](QObject *obj, const QUrl &objUrl) {
        if (!obj && url == objUrl)
            QCoreApplication::exit(-1);
    }, Qt::QueuedConnection);
    engine.load(url);

    return app.exec();
}
