# Analiza: Automatyzacja Pobierania Promocji Bankowych

## Spis treści
1. [Podsumowanie wykonawcze](#1-podsumowanie-wykonawcze)
2. [Źródła danych o promocjach](#2-źródła-danych-o-promocjach)
3. [Integracja z API banków (Open Banking / PSD2)](#3-integracja-z-api-banków-open-banking--psd2)
4. [Metody automatyzacji](#4-metody-automatyzacji)
5. [Architektura proponowanej aplikacji](#5-architektura-proponowanej-aplikacji)
6. [Aspekty prawne](#6-aspekty-prawne)
7. [Rekomendacja](#7-rekomendacja)

---

## 1. Podsumowanie wykonawcze

Pełna automatyzacja pobierania promocji bankowych jest **częściowo możliwa**, ale wymaga połączenia kilku metod. Nie istnieje jedno API, które zwraca listę wszystkich promocji bankowych. Kluczowe wnioski:

| Aspekt | Ocena |
|--------|-------|
| Agregacja informacji o promocjach | Możliwe (scraping + API partnerskie) |
| Automatyczne aktywowanie promocji | Bardzo ograniczone (brak API) |
| Śledzenie spełnienia warunków | Częściowo możliwe (Open Banking AIS) |
| Powiadomienia o nowych promocjach | W pełni możliwe |

---

## 2. Źródła danych o promocjach

### 2.1. System Partnerski Bankier.pl (REKOMENDOWANE)

Najlepsze oficjalne źródło danych. Bankier.pl udostępnia:

- **API produktowe** — pobieranie parametrów produktów bankowych (oprocentowanie, prowizje) w czasie rzeczywistym
- **Plik XML kampanii** — informacje o wszystkich kampaniach reklamowych w systemie partnerskim
- **API statystyk** — statystyki wniosków (przydatne dla modelu cashback/afiliacyjnego)

Wymaga rejestracji jako partner wydawca. Dane aktualizowane na bieżąco przez banki.

### 2.2. Pepper.pl — sekcja "Finanse i ubezpieczenia"

Społecznościowy agregator promocji. Użytkownicy sami dodają oferty bankowe. Brak oficjalnego API — wymagałby scraping lub monitoring RSS.

### 2.3. Strony bankowe (bezpośrednio)

Każdy bank ma sekcję promocji na swojej stronie. Przykładowe URL-e:
- mBank: `/promocje/`
- PKO BP: `/oferta/`
- ING: `/promocje/`
- Santander: `/promocje/`

Wymagają scrapingu (Playwright/Puppeteer).

### 2.4. Programy lojalnościowe kart płatniczych

| Program | Operator | Publiczne API |
|---------|----------|---------------|
| Bezcenne Chwile | Mastercard | **Tak** — Mastercard Loyalty Promotions API (developer.mastercard.com) |
| Visa Oferty / Visa Benefit | Visa | **Tak** — Visa Offers Platform API (ograniczony dostęp, wymaga approval) |
| Goodie (cashback) | Bank Millennium | Brak publicznego API (2.8M instalacji, 800+ sklepów) |

#### Mastercard Developer APIs
Mastercard udostępnia najbardziej dojrzałe API do programów lojalnościowych:
- **Mastercard Loyalty Promotions API** — cashback i punkty, dostępne na [developer.mastercard.com](https://developer.mastercard.com/product/mastercard-loyalty-promotions)
- **Promotions Digital Enablement API** — RESTful API z [reference app na GitHub](https://github.com/Mastercard/promotions-digital-enablement-reference-app)
- **Priceless Platform API** — integracja portalu benefitów

#### Visa Developer APIs
- **Visa Offers Platform (VOP)** — dane o transakcjach w czasie rzeczywistym dla card-linked programs (Merchants API, Offers API, Rewards API). Wymaga kontaktu z Developer@visa.com
- **Visa Merchant Offers Resource Center (VMORC)** — centralne repozytorium ofert z API
- **Visa Card Eligibility Service (VCES)** — weryfikacja uprawnień do benefitów

Sandbox Visa jest darmowy, produkcja wymaga zatwierdzenia.

#### Goodie + BLIK
Goodie (Bank Millennium) i BLIK uruchomili pierwszą w Polsce **wielobankową platformę cashbackową**. Brak publicznego API — integracja wyłącznie przez aplikację konsumencką i partnerstwa z bankami.

Integracja z pozostałymi programami możliwa przez:
- **Mastercard/Visa Developer APIs** (oficjalna droga)
- Partnerstwo biznesowe B2B
- Monitorowanie e-maili z ofertami (IMAP parsing)

---

## 3. Integracja z API banków (Open Banking / PSD2)

### 3.1. Co udostępniają banki przez API?

Polskie banki implementują standard **PolishAPI** (polishapi.org) zgodny z PSD2:

| Usługa | Opis | Przydatność dla promocji |
|--------|------|--------------------------|
| **AIS** (Account Information Service) | Saldo, historia transakcji | Śledzenie warunków promocji (np. "wydaj 500 zł kartą") |
| **PIS** (Payment Initiation Service) | Inicjowanie przelewów | Minimalna |
| **CAF** (Confirmation of Funds) | Potwierdzenie środków | Brak |

### 3.2. Portale deweloperskie polskich banków

| Bank | Portal deweloperski |
|------|---------------------|
| PKO Bank Polski | developers.pkobp.pl |
| mBank | developer.api.mbank.pl |
| ING Bank Śląski | devportal.ing.pl |
| Santander Bank Polska | developer.santander.pl |
| Bank Pekao | developer.pekao.com.pl |
| BNP Paribas | gopsd2.bnpparibas.pl |
| Bank Millennium | openapi.bankmillennium.pl |
| Alior Bank | developer.aliorbank.pl |

### 3.3. Ograniczenia Open Banking API

**API banków NIE udostępniają informacji o promocjach.** Służą wyłącznie do:
- Odczytu salda i historii transakcji (AIS)
- Inicjowania płatności (PIS)

Aby korzystać z tych API, musisz być licencjonowanym **TPP** (Third Party Provider) zarejestrowanym w KNF lub korzystać z agregatora (Tink, TrueLayer, Plaid).

### 3.4. Agregatory Open Banking (alternatywa do bezpośredniej integracji)

Zamiast integrować się z każdym bankiem osobno:

| Agregator | Pokrycie PL | Zastosowanie |
|-----------|-------------|--------------|
| **Tink** (Visa) | Tak | AIS + PIS |
| **TrueLayer** | Tak | AIS + PIS |
| **Plaid** | Ograniczone | AIS |
| **Kontomatik** | Tak (PL focus) | AIS |
| **Salt Edge** | Tak | AIS + PIS |

Te usługi pozwoliłyby na **śledzenie transakcji użytkownika** i automatyczne sprawdzanie, czy spełnia warunki danej promocji.

---

## 4. Metody automatyzacji

### 4.1. Zbieranie informacji o promocjach

```
Metoda 1: API Bankier.pl (System Partnerski)
├── Rejestracja jako wydawca
├── Pobieranie XML z kampaniami
├── Parsowanie i normalizacja danych
└── Aktualizacja co X godzin

Metoda 2: Web Scraping (strony banków + Pepper.pl)
├── Playwright/Puppeteer headless browser
├── Scraping stron /promocje/ każdego banku
├── AI/LLM do ekstrakcji strukturyzowanych danych z HTML
└── Deduplikacja i kategoryzacja

Metoda 3: Monitoring e-mail (newslettery bankowe)
├── Dedykowana skrzynka e-mail
├── Rejestracja na newslettery wszystkich banków
├── IMAP polling + parsing HTML e-maili
└── AI/LLM do ekstrakcji ofert
```

### 4.2. Śledzenie spełnienia warunków promocji

```
Open Banking AIS (wymaga TPP lub agregatora)
├── Użytkownik łączy konta bankowe (consent flow)
├── Cykliczne pobieranie transakcji
├── Matching transakcji do warunków promocji
│   np. "Zapłać kartą 5 razy w miesiącu"
│   np. "Wykonaj przelew na min. 1000 zł"
└── Powiadomienia: "Brakuje Ci 2 transakcji do spełnienia warunku!"
```

### 4.3. Automatyczne aktywowanie promocji

To **najtrudniejsza** część. Banki nie mają API do aktywacji promocji. Opcje:

| Metoda | Wykonalność | Ryzyko |
|--------|-------------|--------|
| Browser automation (Playwright) logujący się do banku | Technicznie możliwe | Bardzo wysokie — narusza regulaminy, ryzyko blokady konta |
| Deep linking do strony aktywacji w apce bankowej | Średnia | Niskie — user klika sam |
| Instrukcje krok-po-kroku dla użytkownika | Pełna | Brak ryzyka |

**Rekomendacja:** Deep linking + instrukcje. NIE automatyzować logowania do banku.

---

## 5. Architektura proponowanej aplikacji

### 5.1. Proponowany stack (bazując na istniejącym projekcie)

```
Backend (Python/FastAPI — już w projekcie):
├── Scraper Service (Playwright + BeautifulSoup)
├── Data Normalization Service (AI/LLM)
├── Open Banking Integration (opcjonalnie, via agregator)
├── Notification Service (push/email)
├── REST API dla frontendu
└── Scheduler (APScheduler / Celery)

Frontend (React/TypeScript — już w projekcie):
├── Dashboard promocji
├── Filtry (bank, typ, kwota)
├── Kalkulator korzyści
├── Tracker warunków (jeśli Open Banking)
└── Powiadomienia

Baza danych:
├── PostgreSQL (już w docker-compose)
├── Promocje (znormalizowane)
├── Użytkownicy + preferencje
└── Historia / tracking
```

### 5.2. Pipeline przetwarzania promocji

```
[Źródła danych]
    │
    ├── Bankier.pl API/XML ──┐
    ├── Scraping stron ──────┤
    ├── Pepper.pl RSS ───────┤
    └── E-mail parsing ──────┘
                             │
                    [Surowe dane HTML/JSON]
                             │
                    [AI/LLM Extraction]
                    Ekstrakcja pól:
                    - nazwa promocji
                    - bank
                    - typ (konto/lokata/karta/kredyt)
                    - warunki
                    - kwota nagrody
                    - daty ważności
                    - link do aktywacji
                             │
                    [Normalizacja + Deduplikacja]
                             │
                    [Baza danych PostgreSQL]
                             │
                    [REST API]
                             │
                    [Frontend React]
```

### 5.3. MVP — co zrobić najpierw

**Faza 1 (MVP):**
1. Scraper stron promocji 5 największych banków
2. AI/LLM do ekstrakcji strukturyzowanych danych
3. API + prosty frontend z listą promocji
4. Powiadomienia e-mail o nowych promocjach

**Faza 2:**
5. Integracja z Bankier.pl System Partnerski
6. Scraping Pepper.pl sekcji finansowej
7. Kalkulator "ile mogę zarobić"
8. Filtrowanie i personalizacja

**Faza 3 (zaawansowana):**
9. Integracja Open Banking (via Tink/TrueLayer) do śledzenia warunków
10. Automatyczne powiadomienia "brakuje Ci X do spełnienia warunku"
11. Historia i portfolio promocji użytkownika

---

## 6. Aspekty prawne

### 6.1. Web Scraping

| Aspekt | Status |
|--------|--------|
| Scraping publicznych stron promocji | Generalnie dozwolone (dane publiczne, nieosobowe) |
| Scraping za logowaniem | Narusza regulaminy serwisów |
| Republikacja treści 1:1 | Narusza prawa autorskie |
| Agregacja i transformacja danych | Dozwolone (tworzysz nową wartość) |

**Kluczowe aspekty prawne UE:**
- **RODO** — dotyczy wyłącznie danych osobowych. Scraping publicznych cen, oprocentowań i warunków promocji (dane nieosobowe) **nie podlega RODO**
- **Precedens PL (sprawa Bisnode, 2019)** — kara ~220 000 EUR dotyczyła scrapingu **danych osobowych** (imiona, e-maile, telefony) z rejestrów publicznych. Nie ma zastosowania do danych o promocjach bankowych
- **Dyrektywa o bazach danych (96/9/EC)** — sui generis prawo chroni przed ekstrakcją "istotnej części" bazy danych. Ryzyko niskie przy pobieraniu pojedynczych ofert
- **DORA (od stycznia 2025)** — banki muszą monitorować wszystkie interakcje ICT. Zautomatyzowany ruch może wywołać alerty bezpieczeństwa
- **Regulaminy serwisów** — większość banków zabrania zautomatyzowanego dostępu w ToS. Naruszenie ToS nie jest przestępstwem, ale może prowadzić do odpowiedzialności cywilnej

**Rekomendowane praktyki:**
- Scraping tylko publicznych stron (bez logowania)
- Respektowanie robots.txt i rate limits (1 request / 10-15 sekund)
- Transformacja danych (nie kopiuj 1:1)
- Wysyłanie powiadomień zamiast auto-enrollmentu

### 6.2. Open Banking / PSD2

- Wymaga licencji TPP od KNF **lub** korzystania z licencjonowanego agregatora
- Użytkownik musi wyrazić jawną zgodę (consent) na dostęp do danych
- Dane objęte RODO — wymaga polityki prywatności, DPA

### 6.3. Programy partnerskie

- Bankier.pl System Partnerski — legalna i oficjalna metoda
- Programy afiliacyjne banków — legalne, wymagają umowy partnerskiej

---

## 7. Rekomendacja

### Optymalna strategia automatyzacji

```
TIER 1 — Łatwe i legalne (start here):
✓ System Partnerski Bankier.pl (API + XML)
✓ Scraping publicznych stron promocji banków
✓ Monitoring Pepper.pl (sekcja Finanse)
✓ Parsing newsletterów bankowych

TIER 2 — Średni nakład:
✓ AI/LLM do automatycznej ekstrakcji i kategoryzacji
✓ Kalkulator opłacalności promocji
✓ System powiadomień

TIER 3 — Zaawansowane (wymaga budżetu/licencji):
✓ Open Banking via agregator (Tink/Kontomatik)
  do śledzenia spełnienia warunków promocji
✓ Partnerstwa B2B z bankami
```

### Odpowiedź na kluczowe pytanie

> **Czy można zintegrować się z API banku do pobierania promocji?**

**NIE bezpośrednio.** API banków (PSD2/PolishAPI) nie zwracają informacji o promocjach — tylko saldo i transakcje. Natomiast:
- Można je wykorzystać do **śledzenia spełnienia warunków** promocji
- Do **pobierania samych promocji** trzeba użyć scrapingu, API Bankier.pl lub parsingu e-maili
- Pełna automatyzacja (aktywacja promocji) jest **nierealistyczna** bez naruszania regulaminów banków

### Luka rynkowa

Nie istnieje żadne narzędzie w Polsce, które programatycznie agreguje promocje bankowe i powiadamia użytkowników. Wszystkie serwisy agregujące (LiveSmarter.pl, ZarabiajNaBankach.pl, PolakOszczedza.pl, Zgarnijpremie.pl, Moniaki.pl, Banklovers.pl) są prowadzone **ręcznie przez blogerów**. To realna szansa rynkowa — szczególnie w modelu: scraping publicznych stron + AI do ekstrakcji + powiadomienia.

### Źródła

**Open Banking / PSD2:**
- [PolishAPI — standard Open Banking](https://polishapi.org/en/)
- [PolishAPI — lista banków komercyjnych](https://polishapi.org/en/commercial-banks/)
- [Open Banking in Poland — tracker](https://www.openbankingtracker.com/country/poland)
- [Berlin Group PSD2 Framework](https://www.berlin-group.org/psd2-access-to-bank-accounts)

**Portale deweloperskie banków:**
- [PKO Bank Polski — Portal Developera](https://developers.pkobp.pl/en/page/start)
- [mBank — Portal deweloperski](https://developer.api.mbank.pl/)
- [Santander — API Portal](https://developer.santander.pl/)
- [ING Bank Śląski — Dev Portal](https://devportal.ing.pl/)
- [Bank Millennium — Open API](https://openapi.bankmillennium.pl/)
- [BNP Paribas](https://gopsd2.bnpparibas.pl/)
- [Alior Bank](https://developer.aliorbank.pl/)
- [Bank Pekao SA](https://developer.pekao.com.pl/)

**Programy lojalnościowe — API:**
- [Mastercard Loyalty Promotions API](https://developer.mastercard.com/product/mastercard-loyalty-promotions)
- [Mastercard Promotions — GitHub Reference App](https://github.com/Mastercard/promotions-digital-enablement-reference-app)
- [Visa Offers Platform (VOP)](https://developer.visa.com/capabilities/vop)
- [Visa Merchant Offers Resource Center](https://developer.visa.com/capabilities/vmorc)
- [Mastercard Bezcenne Chwile](https://bezcennechwile.mastercard.pl/)
- [Goodie + BLIK — platforma cashbackowa](https://socialpress.pl/en/2025/10/goodie-i-blik-tworza-pierwsza-w-polsce-wielobankowa-platforme-cashbackowa/)

**Agregatory promocji:**
- [Bankier.pl — promocje bankowe](https://www.bankier.pl/smart/najlepsze-promocje-bankowe-konta-lokaty-kredyty-pozyczki-lipiec-2025)
- [System Partnerski Bankier.pl](https://www.systempartnerski.pl/)
- [LiveSmarter.pl](https://livesmarter.pl/)
- [ZarabiajNaBankach.pl](https://zarabiajnabankach.pl/)
- [PolakOszczedza.pl — promocje bankowe](https://polakoszczedza.pl/promocje-bankowe/)
- [Zgarnijpremie.pl](https://zgarnijpremie.pl/)
- [Pepper.pl — Finanse i ubezpieczenia](https://www.pepper.pl/grupa/finanse-i-ubezpieczenia)

**Aspekty prawne:**
- [IAPP: Web Scraping in the EU](https://iapp.org/news/a/the-state-of-web-scraping-in-the-eu)
- [GDPR Local: Is Scraping Legal?](https://gdprlocal.com/is-website-scraping-legal-all-you-need-to-know/)
- [Polish DPA Fine — sprawa Bisnode](https://www.insideprivacy.com/data-privacy/polish-supervisory-authority-issues-gdpr-fine-for-data-scraping-without-informing-individuals/)

**Open Banking agregatory:**
- [Kontomatik](https://www.kontomatik.com)
- [Tink](https://tink.com/)
- [TrueLayer](https://truelayer.com/)

**Narzędzia do browser automation:**
- [Playwright](https://github.com/microsoft/playwright)
- [Apify — Logging into Websites](https://docs.apify.com/academy/puppeteer-playwright/common-use-cases/logging-into-a-website)
