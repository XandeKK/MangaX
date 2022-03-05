from bs4 import BeautifulSoup;
import cfscrape;
import subprocess

# Database
def openDatabase():
    import sqlite3;

    connection = sqlite3.connect('./database.db');

    return connection;

def closeDatabase(connection):
    connection.close()

def selectDatabase():

    connection = openDatabase();
    cur = connection.cursor();

    cur.execute('SELECT * FROM manga ORDER BY name ASC');

    return cur.fetchall();

def updateAvailableBanco(name: str, new_chapter: str):

    connection = openDatabase();
    cur = connection.cursor();

    cur.execute(""" UPDATE manga
                    SET available = ?,
                    new_chapter = ?
                    WHERE name = ?
        """, ("yes", new_chapter, name));

    connection.commit();

    closeDatabase(connection);

# WebScraping

def scrapWeb(url: str):
    scraper = cfscrape.create_scraper();
    html = scraper.get(url).content;

    soup = BeautifulSoup(html, 'html.parser');
    #Element Object do último capítulo do manga


def scrapWebMangaLivre(url: str):
    try:
        scraper = cfscrape.create_scraper();
        html = scraper.get(url).content;

        soup = BeautifulSoup(html, 'html.parser');

        div = soup.find("div", class_="container-box default color-brown");

        chapter = div.find("span").string;

        return chapter;
    except:
        try:
            html = subprocess.check_output(f"wget {url} -O - -q", shell=True)

            soup = BeautifulSoup(html, 'html.parser');

            div = soup.find("div", class_="container-box default color-brown");

            chapter = div.find("span").string;

            return chapter;
        except:
            return 0;


def verifyNewChapter():
    percent = 100 / len(selectDatabase());
    for enum, manga in enumerate(selectDatabase()):
        print(f"loading {percent*(enum+1)}%")
        name: str = manga[0];
        url: str = manga[1];
        current_chapter: int = int(manga[2]);

        if(url.find("mangalivre") != -1):
            new_chapter: int = int(scrapWebMangaLivre(url));
            if(new_chapter > current_chapter):
                updateAvailableBanco(name, str(new_chapter));
        else: # o dominio do site de manga
            pass;

verifyNewChapter();
