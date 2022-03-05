#include "database.h"

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
    query.exec("CREATE TABLE IF NOT EXISTS manga(name VARCHAR(255) NOT NULL UNIQUE, url VARCHAR(255) NOT NULL, chapter INT not null");
}

void Database::addManga(QString &name, QString &url, QString &chapter)
{
    query.prepare("INSERT INTO manga VALUES (:name, :url, :chapter)");
    query.bindValue(":name", name);
    query.bindValue(":url", url);
    query.bindValue(":chapter", chapter);
    query.exec();
}

void Database::removeManga(QString &name)
{
    query.prepare("DELETE FROM manga WHERE name = :name");
    query.bindValue(":name", name);
    query.exec();
}

void Database::editManga(QString &nameOld, QString &name, QString &url, QString &chapter)
{
    removeManga(nameOld);
    addManga(name, url, chapter);
}
