# 🛋️ MebleLab 3D

[![CI](https://github.com/Mateuszl28/rekrutacja1/actions/workflows/ci.yml/badge.svg)](https://github.com/Mateuszl28/rekrutacja1/actions/workflows/ci.yml)

Sklep meblowy w 3D ze **zintegrowanym planerem pomieszczeń** (salon / kuchnia).
Przeglądasz katalog, wstawiasz meble do pokoju 3D, aranżujesz je na żywo, a to co
ustawisz w pomieszczeniu jest jednocześnie Twoim koszykiem — z sumą do zapłaty.

**🔴 Demo na żywo:** http://85.215.197.199:8090/

> Zadanie rekrutacyjne — działające demo. Stack: **vanilla Three.js + TypeScript + Vite**
> na froncie i **lekki backend koszyka** (wbudowany `http` Node, bez zależności).

## Funkcje

- 🛒 **Katalog 3D** z 21 meblami w dwóch kategoriach (salon / kuchnia), warianty kolorów, ceny w PLN.
- 📐 **Warianty rozmiarowe** — 6 produktów ma warianty (np. sofa 2-os/3-os/narożna, stół na 4/6/8 osób, szafki 45/60/80 cm) z własnym gabarytem i ceną; model skaluje się w scenie, a kolizje i koszyk używają rozmiaru wariantu. Wariant wybiera się w katalogu i można go zmienić dla ustawionego mebla.
- 📦 **Realne modele `.glb`** — ładowane `GLTFLoaderem` z `public/models/` (pełny pipeline glTF, offline).
- 🧩 **Planer = koszyk** — meble ustawione w pokoju tworzą listę zamówienia z sumą.
- 🖱️ **Aranżacja w scenie** — dodawanie klikiem lub **przeciągnij-i-upuść**, przesuwanie po podłodze, obrót, zmiana koloru w locie, usuwanie, **duplikowanie**, **strzałki** do precyzyjnego przesuwania.
- 🧱 **Meble wiszące** — szafki górne, TV, obraz i kinkiet **przylegają do ścian** i ślizgają się po nich; kolizje uwzględniają wysokość (górne nie kolidują z dolnymi).
- 🚧 **Kolizje blokujące ruch** — mebel nie wjeżdża w inny; „ślizga się” po przeszkodzie (rozdzielenie osi). Przy dodawaniu automatycznie szuka wolnego miejsca.
- ✨ **Realistyczna scena** — proceduralne tekstury podłóg (drewno / płytki), mapa środowiska (odbicia na metalu/stali), tone mapping ACES, cienie.
- 🧲 **Przyciąganie do siatki**, granice pokoju z uwzględnieniem obrotu.
- ↶↷ **Cofnij / Ponów** (pełna historia zmian).
- 🏠 **Konfigurowalny pokój** — rozmiar (szer./gł.), kolor ścian, powierzchnia w m²; presety salon/kuchnia.
- 🎥 **Kamera** — orbita, zoom, rzut z góry (2D), reset widoku.
- ☁️ **Backend koszyka** — składanie zamówień (numer + trwały zapis), **historia zamówień** i zapis/odczyt projektu w chmurze; front działa też offline (fallback do localStorage).
- 🧾 **Proces zamówienia** — wieloetapowy checkout: koszyk → dane klienta i dostawa (walidacja) → potwierdzenie z numerem; **opcje dostawy z kosztem** (kurier/ekspres/odbiór), **kody rabatowe** (MEBLE10, GRATIS) i podsumowanie na żywo; backend zapisuje klienta, dostawę i pozycje.
- ⬇️ **Eksport CSV** zamówień z panelu obsługi (z BOM — poprawne polskie znaki w Excelu).
- 🖼️ **Miniatura aranżacji** zapisywana przy zamówieniu i widoczna w panelu obsługi.
- 📈 **Wykres sprzedaży** (top produkty wg obrotu) w statystykach panelu obsługi, z podpowiedzią udziału w obrocie na słupku.
- 🗂️ **Filtr statusów i sortowanie** zamówień w panelu obsługi (najnowsze/najstarsze, wartość rosnąco/malejąco).
- 🎨 **Własne kolory** — dowolny odcień ścian i zaznaczonego mebla (natywny próbnik koloru), obok gotowych próbek.
- 🖼️ **Miniatury 3D** produktów w katalogu (renderowane z modeli `.glb`) + **wyszukiwarka**.
- 🔍 **Szybki podgląd produktu** — modal z interaktywnym modelem 3D (auto-obrót + przeciąganie), zmianą wariantu i koloru na żywo, wymiarami i przyciskiem „Dodaj do projektu".
- ♥ **Ulubione / lista życzeń** — serce na kartach, licznik i filtr „tylko ulubione"; wybór zapamiętywany w przeglądarce.
- ⇄ **Porównywarka produktów** — zaznacz do 4 mebli i zobacz specyfikacje obok siebie (cena/zakres cen, wymiary, kategoria, montaż, warianty, kolory, opis) z możliwością dodania do projektu wprost z tabeli.
- ✨ **Gotowe aranżacje** (jeden klik umeblowuje pokój) i **zestawy mebli** (np. stół + 6 krzeseł, strefa wypoczynku) dodawane do bieżącego pokoju jako jedna operacja.
- 🧾 **Wydruk/PDF** podsumowania zamówienia.
- 📐 **Rzut 2D z wymiarami** — schematyczny widok z góry (SVG, skala zachowana) z gabarytami mebli, numeracją, legendą i wymiarami ścian; gotowy do druku/PDF.
- 🧭 **Uporządkowany interfejs** — pogrupowany pasek narzędzi, rzadsze akcje w menu „⋯".
- 🌗 **Motyw jasny / ciemny** — przełącznik w pasku (zapamiętywany, z poszanowaniem preferencji systemu i bez migotania przy starcie); spójny system tokenów CSS, a HUD-y nad sceną 3D pozostają czytelne w obu motywach.
- 🚀 **Onboarding** — ekran powitalny przy pierwszym wejściu i modal pomocy ze skrótami (❓).
- 📱 **Responsywność** — na wąskich ekranach katalog i koszyk działają jako wysuwane panele (dotyk).
- 🛠️ **Panel obsługi zamówień** — podgląd zamówień z danymi klienta i dostawy, zmiana statusu oraz **statystyki sprzedaży** (liczba, obrót, średnia, rozkład statusów, top produkty).
- 🔎 **Sortowanie katalogu** (cena / nazwa) obok wyszukiwarki, **filtr cen** (przedziały) i **miniatury reagujące na wybór koloru** (klik próbki przerenderowuje model w danym kolorze).
- 📏 **HUD wymiarów** — dla zaznaczonego mebla pokazuje gabaryt i odległości od ścian (aktualizowane na żywo przy przeciąganiu).
- 📐 **Prowadnice wyrównania** — podczas przeciągania pokazują się linie, gdy mebel wyrównuje się do sąsiada lub ściany.
- 💾 **Zapis / odczyt** projektu i **zrzut PNG** aranżacji.

## Uruchomienie

```bash
npm install
npm run dev          # sam frontend (http://localhost:5173) — działa też bez backendu
```

Aby uruchomić **z backendem koszyka** (zamówienia, historia, zapis w chmurze):

```bash
npm run dev:full     # frontend + backend (http://localhost:3031) równolegle
```

Pozostałe skrypty:

```bash
npm run server       # sam backend koszyka
npm run models       # regeneracja modeli .glb do public/models/
npm run build        # produkcyjny build (type-check + vite build → dist/)
npm run typecheck    # sama kontrola typów TypeScript
npm test             # testy jednostkowe (Vitest)
```

### Testy

Czysta logika domenowa jest odseparowana od warstwy 3D/DOM i pokryta testami (Vitest):

- `src/scene/geometry.ts` — analityczne AABB, obwiednie po obrocie, zakresy Y i
  wykrywanie kolizji (w tym rozdział meble podłogowe / wiszące). `Planner` korzysta
  z tego modułu, więc test geometrii = test rdzenia kolizji.
- `src/data/products.ts` — warianty (rozmiar/cena), spójność `variants[0]` z bazą.
- Integralność danych — elementy zestawów i aranżacji wskazują istniejące produkty
  i poprawne warianty.

```bash
npm test             # jednorazowo (CI)
npx vitest           # tryb watch
```

> Modele `.glb` są już wygenerowane i wersjonowane w `public/models/`, więc aplikacja
> działa od razu po `npm install`. `npm run models` uruchamiaj tylko po zmianie mebli.

## Sterowanie

| Akcja | Sposób |
|---|---|
| Dodaj mebel | klik karty w katalogu lub przeciągnij ją na scenę |
| Przesuń | przeciągnij mebel myszą (wiszące — po ścianie) |
| Precyzyjny ruch | strzałki ← ↑ → ↓ |
| Zaznacz / odznacz | klik mebla / `Esc` lub klik w podłogę |
| Obróć o 45° | `R` lub ↻ |
| Duplikuj | `Ctrl+D` lub ⧉ |
| Usuń | `Delete` / `Backspace` lub 🗑️ |
| Cofnij / Ponów | `Ctrl+Z` / `Ctrl+Y` lub ↶ ↷ |
| Orbita kamery | przeciągnij tło |
| Zoom / pan | kółko / prawy przycisk |
| Widok z góry / reset | „Widok 2D” / 🎯 |
| Przyciąganie do siatki | „🧲 Siatka” |
| Historia zamówień | „📋 Zamówienia” |
| Zrzut ekranu | 📸 |

## Architektura

```
src/
├── main.ts                 # orkiestracja: UI, zdarzenia, koszyk, historia, backend
├── style.css               # motyw i layout aplikacji
├── types.ts                # wspólne typy domenowe
├── api.ts                  # klient backendu (z fallbackiem offline)
├── data/
│   └── products.ts         # katalog produktów (dane mockowane)
├── furniture/
│   ├── factory.ts          # proceduralne modele mebli (bryły Three.js)
│   └── loader.ts           # ładowanie/instancjonowanie modeli .glb (GLTFLoader)
└── scene/
    ├── SceneManager.ts     # renderer, kamera, światło, env-map, pętla, widok 2D/3D
    ├── Room.ts             # parametryczny pokój (podłoga z teksturą, ściany, presety)
    ├── textures.ts         # proceduralne tekstury podłóg (canvas)
    ├── geometry.ts         # czysta geometria kolizji AABB (bez Three.js — testowalna)
    └── Planner.ts          # dodawanie, drag, kolizje 3D, montaż ścienny, zapis
scripts/
└── export-glb.ts           # eksport fabryki mebli do public/models/*.glb (GLTFExporter)
server/
└── index.mjs               # backend koszyka (Node http, bez zależności)
```

## Backend — API

Domyślnie `http://localhost:3031`, dane trwałe w `server/data.json`. Frontend łączy się
przez proxy Vite (`/api`).

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/health` | status + liczba zamówień |
| GET | `/api/orders` | lista zamówień (podsumowania) |
| POST | `/api/orders` | złóż zamówienie `{ items, total, room }` → `{ orderNo, createdAt }` |
| POST | `/api/cart` | zapisz projekt `{ snapshot }` → `{ id }` |
| GET | `/api/cart/:id` | wczytaj zapisany projekt |

## Wdrożenie

Aplikacja jest wdrożona na VPS (Ubuntu + systemd) pod **http://85.215.197.199:8090/**.
Backend (`server/index.mjs`, bez zależności) serwuje statyczny build z `dist/` oraz API
na jednym porcie. Wdrożenie jest powtarzalne:

```bash
# Windows + PuTTY (pscp/plink w PATH)
KEY='C:\Users\lagoc\Desktop\vps.ppk' HOST='root@85.215.197.199' PORT=8090 bash deploy/deploy.sh
```

Skrypt buduje front, kopiuje `dist/` + serwer, instaluje usługę `deploy/meblelab-3d.service`
(`Restart=always`, autostart) i restartuje ją — nie ruszając innych usług na serwerze.

## Kluczowe decyzje projektowe

- **Planer = koszyk.** Sceną zakupu jest sam pokój — meble ustawione w 3D tworzą listę
  zamówienia z ceną. To integruje sklep z planerem, zamiast trzymać je osobno.
- **Pipeline glTF, offline.** Meble są autorsko generowane proceduralnie, ale w aplikacji
  przechodzą przez prawdziwe pliki `.glb` (GLTFExporter → GLTFLoader → cache → klon).
  Aby użyć własnego/kupionego modelu, wystarczy podmienić `public/models/<klucz>.glb`.
- **Zmiana koloru po nazwie materiału.** Materiały kolorowalne są oznaczone `primary`,
  co przetrwa round-trip do `.glb` — kolor zmieniamy na sklonowanej instancji.
- **Kolizje 3D blokujące ruch.** Analityczne AABB w osiach X/Z/Y — mebel nie wjeżdża
  w inny, ślizga się po przeszkodzie, a szafki górne nie kolidują z dolnymi.
- **Odporność na brak backendu.** Każde wywołanie API ma fallback (localStorage / tryb
  offline), więc `npm run dev` działa samodzielnie.

## Możliwa rozbudowa

Baza danych zamiast pliku JSON, konta użytkowników i zapis wielu projektów,
realne modele `.glb` z CDN, płatności online, wariantowe kolory tapicerki na modelach.
