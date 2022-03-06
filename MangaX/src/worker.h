#ifndef WORKER_H
#define WORKER_H

#include <QObject>
#include <QDebug>

class Worker : public QObject
{
    Q_OBJECT
public:
    explicit Worker(QObject *parent = nullptr);
    ~Worker();

    Q_INVOKABLE void openPython();
    Q_INVOKABLE bool getFinishedWebScraping();

public slots:
    void process();
    void finishedWeb();

signals:
    void finished();
    void error(QString err);

private:
    bool m_FinishedWebScraping = false;

};

#endif // WORKER_H
