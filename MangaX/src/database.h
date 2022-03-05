#ifndef DATABASE_H
#define DATABASE_H

#include <QObject>
#include <QSqlDatabase>


class Database : public QObject
{
    Q_OBJECT
public:
    explicit Database(QObject *parent = nullptr);

    void openDatabase();
    void createTable();

    Q_INVOKABLE void addManga(QString &name, QString &url, QString &chapter);
    Q_INVOKABLE void removeManga(QString &name);
    Q_INVOKABLE void editManga(QString &nameOld, QString &name, QString &url, QString &chapter);


private:
    QSqlDatabase m_db;

signals:

};

#endif // DATABASE_H
