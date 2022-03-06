from bs4 import BeautifulSoup;
import cfscrape;
import subprocess
import requests
from lxml.html import fromstring

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

def to_get_proxies():
    url = 'https://free-proxy-list.net/'

    response = requests.get(url)

    parser = fromstring(response.content)

    for item in parser.xpath('//tbody/tr')[:10]:

        if item.xpath('.//td[7][contains(text(),"yes")]'):

            proxy = ":".join([item.xpath('.//td[1]/text()')[0],
                              item.xpath('.//td[2]/text()')[0]])

            return proxy

def scrapWeb(url: str):
    scraper = cfscrape.create_scraper();
    html = scraper.get(url).content;

    soup = BeautifulSoup(html, 'html.parser');
    #Element Object do último capítulo do manga


def scrapWebMangaLivre(url: str):
    try:
        html = subprocess.check_output(f"wget {url} -O - -q  -e use_proxy=on -e http_proxy={to_get_proxies()}", shell=True)

        soup = BeautifulSoup(html, 'html.parser');

        div = soup.find("div", class_="container-box default color-brown");

        chapter = div.find("span").string;

        return chapter;
    except:
        return 0;


def verifyNewChapter():
    for enum, manga in enumerate(selectDatabase()):
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
