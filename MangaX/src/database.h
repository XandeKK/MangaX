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

    Q_INVOKABLE void selectAllChapter();
    Q_INVOKABLE void addManga(QString &name, QString &url, QString &chapter);
    Q_INVOKABLE void removeManga(QString &name);
    Q_INVOKABLE void editManga(QString &nameOld, QString &name, QString &url, QString &chapter);
    Q_INVOKABLE void readedManga(QString &name, QString &chapterNew);

    Q_INVOKABLE QByteArray getListNewChapter();
    Q_INVOKABLE QByteArray getListOldChapter();

private:
    QSqlDatabase m_db;
    QByteArray m_listNewChapter;
    QByteArray m_listOldChapter;

signals:

};

#endif // DATABASE_H
