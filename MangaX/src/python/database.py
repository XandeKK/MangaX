def openDatabase():
    import sqlite3;

    connection = sqlite3.connect('./database.db');

    return connection;

def closeDatabase(connection):
    connection.close()

def selectDatabase():

    connection = openDatabase();
    cur = connection.cursor();

    cur.execute('SELECT * FROM mangas ORDER BY name ASC');

    return cur.fetchall();

def updateAvailableBanco(name: str, new_chapter: str):

    connection = openDatabase();
    cur = connection.cursor();

    cur.execute(""" UPDATE mangas
                    SET available = ?,
                    new_chapter = ?
                    WHERE name = ?
        """, ("yes", new_chapter, name));

    connection.commit();

    closeDatabase(connection);
