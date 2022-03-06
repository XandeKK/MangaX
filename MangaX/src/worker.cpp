#include <Python.h>
#include "worker.h"
#include <QThread>
#include <QDebug>

Worker::Worker(QObject *parent)
    : QObject{parent}
{

}

Worker::~Worker()
{

}

void Worker::openPython()
{
    QThread* thread = new QThread;
    Worker* worker = new Worker();
    worker->moveToThread(thread);
    //    connect(worker, SIGNAL(error(QString)), this, SLOT(errorString(QString)));
    connect(thread, SIGNAL(started()), worker, SLOT(process()));
    connect(worker, SIGNAL(finished()), thread, SLOT(quit()));
    connect(worker, SIGNAL(finished()), worker, SLOT(deleteLater()));
    connect(thread, SIGNAL(finished()), thread, SLOT(deleteLater()));
    connect(worker, SIGNAL(finished()), this, SLOT(finishedWeb()));
    thread->start();
}

bool Worker::getFinishedWebScraping()
{
    return m_FinishedWebScraping;
}

void Worker::process()
{
    char filename[] = "/home/alexandre/Documents/GitHub/MangaX/MangaX/src/python/scraping.py";
    FILE *fp;

    Py_Initialize();

    fp = _Py_fopen(filename, "r");
    PyRun_SimpleFile(fp, filename);

    Py_Finalize();
    emit finished();
}

void Worker::finishedWeb()
{
    m_FinishedWebScraping = true;
}
