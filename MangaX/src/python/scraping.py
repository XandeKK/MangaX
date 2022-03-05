from bs4 import BeautifulSoup;
import cfscrape;
import database;

def scrapWeb(url: str):
    scraper = cfscrape.create_scraper();
    html = scraper.get(url).content;

    soup = BeautifulSoup(html, 'html.parser');


def verifyNewChapter():
    for manga in database.selectDatabase():
        name: str = manga[0];
        url: str = manga[1];
        current_chapter: int = int(manga[2]);
        new_chapter: int = scrapWeb(url);

        if(new_chapter > current_chapter):
            database.updateAvailableBanco(name, str(new_chapter));



