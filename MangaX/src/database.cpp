#include "database.h"
#include <QSqlQuery>
#include <QSqlRecord>
#include <QJsonObject>
#include <QJsonArray>
#include <QJsonDocument>

Database::Database(QObject *parent)
    : QObject{parent}
{

}

void Database::openDatabase() {
    m_db = QSqlDatabase::addDatabase("QSQLITE");
    m_db.setDatabaseName("database.db");

    if(!m_db.open()){
        qDebug() << "Error: connection with database failed";
    }else {
        qDebug() << "Database: connection ok";
    }
}

void Database::createTable()
{
    QSqlQuery query;
    query.exec("CREATE TABLE IF NOT EXISTS manga("
               "name VARCHAR(255) NOT NULL UNIQUE,"
               " url VARCHAR(255) NOT NULL,"
               " current_chapter INT NOT NULL,"
               " new_chapter INT,"
               " available CHAR(3))");
}

void Database::selectAllChapter()
{
    QJsonObject listNewJson;
    QJsonObject listOldJson;
    QJsonArray arrayNew;
    QJsonArray arrayOld;

    QSqlQuery query("SELECT * FROM manga ORDER BY name ASC");
    int idName = query.record().indexOf("name");
    int idUrl = query.record().indexOf("url");
    int idCurrentChapter = query.record().indexOf("current_chapter");
    int idNewChapter = query.record().indexOf("new_chapter");
    int idAvailable = query.record().indexOf("available");

    while (query.next()){
        QString name = query.value(idName).toString();
        QString url = query.value(idUrl).toString();
        QString currentChapter = query.value(idCurrentChapter).toString();
        QString newChapter = query.value(idNewChapter).toString();
        QString available = query.value(idAvailable).toString();

        if(available == "yes"){
            listNewJson.insert("name", QJsonValue::fromVariant(name));
            listNewJson.insert("url", QJsonValue::fromVariant(url));
            listNewJson.insert("currentChapter", QJsonValue::fromVariant(currentChapter));
            listNewJson.insert("newChapter", QJsonValue::fromVariant(newChapter));
            arrayNew.push_back(listNewJson);
        }else {
            listOldJson.insert("name", QJsonValue::fromVariant(name));
            listOldJson.insert("url", QJsonValue::fromVariant(url));
            listOldJson.insert("currentChapter", QJsonValue::fromVariant(currentChapter));
            listOldJson.insert("newChapter", QJsonValue::fromVariant(newChapter));
            arrayOld.push_back(listOldJson);
        }
    }
    m_listNewChapter = QJsonDocument(arrayNew).toJson(QJsonDocument::Compact);
    m_listOldChapter = QJsonDocument(arrayOld).toJson(QJsonDocument::Compact);
}

void Database::addManga(QString &name, QString &url, QString &chapter)
{
    QSqlQuery query;
    query.prepare("INSERT INTO manga VALUES (:name, :url, :chapter, :chapter, 'no')");
    query.bindValue(":name", name);
    query.bindValue(":url", url);
    query.bindValue(":chapter", chapter);
    query.exec();
}

void Database::removeManga(QString &name)
{
    QSqlQuery query;
    query.prepare("DELETE FROM manga WHERE name = :name");
    query.bindValue(":name", name);
    query.exec();
}

void Database::editManga(QString &nameOld, QString &name, QString &url, QString &chapter)
{
    removeManga(nameOld);
    addManga(name, url, chapter);
}

void Database::readedManga(QString &name, QString &chapterNew)
{
    QSqlQuery query;
    query.prepare("UPDATE manga set current_chapter = :current_chapter, available = 'no' where name = :name");
    query.bindValue(":current_chapter", chapterNew);
    query.bindValue(":name", name);

    query.exec();
}

QByteArray Database::getListNewChapter()
{
    return m_listNewChapter;
}

QByteArray Database::getListOldChapter()
{
    return m_listOldChapter;
}
