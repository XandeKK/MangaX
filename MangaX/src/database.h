#ifndef DATABASE_H
#define DATABASE_H

#include <QObject>

class Database : public QObject
{
    Q_OBJECT
public:
    explicit Database(QObject *parent = nullptr);

    void addManga();
    void removeManga();
    void editManga();


signals:

};

#endif // DATABASE_H
