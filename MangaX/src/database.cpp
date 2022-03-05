#include "database.h"
#include <QSqlQuery>
#include <QSqlRecord>

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
               " new_chapter INT NOT NULL,"
               " available CHAR(3))");
}

void Database::addManga(QString &name, QString &url, QString &chapter)
{
    QSqlQuery query;
    query.prepare("INSERT INTO manga VALUES (:name, :url, :chapter, 'no')");
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
