# 🛋️ MebleLab 3D

Sklep meblowy w 3D ze **zintegrowanym planerem pomieszczeń** (salon / kuchnia).
Przeglądasz katalog, wstawiasz meble do pokoju 3D, aranżujesz je na żywo, a to co
ustawisz w pomieszczeniu jest jednocześnie Twoim koszykiem — z sumą do zapłaty.

> Zadanie rekrutacyjne — działające demo. Stack: **vanilla Three.js + TypeScript + Vite**.
> Modele mebli generowane są proceduralnie z brył Three.js, więc projekt jest w pełni
> samowystarczalny (żadnych zewnętrznych plików `.glb`).

## Funkcje

- 🛒 **Katalog 3D** z 17 meblami w dwóch kategoriach (salon / kuchnia), warianty kolorów, ceny w PLN.
- 🧩 **Planer = koszyk** — meble ustawione w pokoju tworzą listę zamówienia z sumą.
- 🖱️ **Aranżacja w scenie** — dodawanie klikiem lub **przeciągnij-i-upuść**, przesuwanie po podłodze, obrót, zmiana koloru w locie, usuwanie, **duplikowanie**.
- 🚧 **Wykrywanie kolizji** — nakładające się meble podświetlają się na czerwono i blokują zamówienie.
- 🧲 **Przyciąganie do siatki**, granice pokoju z uwzględnieniem obrotu.
- ↶↷ **Cofnij / Ponów** (pełna historia zmian).
- 🏠 **Konfigurowalny pokój** — rozmiar (szer./gł.) i kolor ścian; presety salon/kuchnia.
- 🎥 **Kamera** — orbita, zoom, rzut z góry (2D), reset widoku.
- 💾 **Zapis / odczyt** projektu (localStorage) i **zrzut PNG** aranżacji.

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja otworzy się automatycznie na `http://localhost:5173`.

Inne skrypty:

```bash
npm run build      # produkcyjny build (type-check + vite build → dist/)
npm run preview    # podgląd builda produkcyjnego
npm run typecheck  # sama kontrola typów TypeScript
```

## Jak używać

1. **Wybierz pomieszczenie** u góry: 🛋️ Salon lub 🍳 Kuchnia — zmienia się wielkość
   pokoju, podłoga i katalog.
2. **Dodaj meble** — kliknij kartę produktu w katalogu (po lewej). Mebel pojawi się
   w pokoju i od razu trafi do koszyka (po prawej).
3. **Aranżuj** w scenie 3D:
   - **przeciągnij** mebel myszą, aby go przesunąć (przyciąganie do siatki),
   - **kliknij** mebel, aby go zaznaczyć — pojawi się panel z kolorami i akcjami,
   - **obróć** klawiszem `R` lub przyciskiem ↻,
   - **usuń** klawiszem `Delete` lub ikoną 🗑️,
   - **odznacz** klawiszem `Esc`.
4. **Obracaj kamerę** — przeciągnij tło (lewy przycisk), przybliżaj kółkiem, przesuwaj
   prawym przyciskiem. Przycisk **Widok 2D** przełącza rzut z góry.
5. **Kolor** — próbki koloru na karcie w katalogu (przed dodaniem) lub w panelu
   zaznaczonego mebla (zmiana w locie).
6. **Zapisz / Wczytaj** projekt (localStorage) oraz **Zamów aranżację** (podsumowanie).

## Sterowanie

| Akcja | Sposób |
|---|---|
| Dodaj mebel | klik karty w katalogu lub przeciągnij ją na scenę |
| Przesuń | przeciągnij mebel myszą |
| Zaznacz / odznacz | klik mebla / `Esc` lub klik w podłogę |
| Obróć o 45° | `R` lub ↻ |
| Duplikuj | `Ctrl+D` lub ⧉ |
| Usuń | `Delete` / `Backspace` lub 🗑️ |
| Cofnij / Ponów | `Ctrl+Z` / `Ctrl+Y` lub ↶ ↷ |
| Orbita kamery | przeciągnij tło |
| Zoom / pan | kółko / prawy przycisk |
| Widok z góry | przycisk „Widok 2D”, reset → 🎯 |
| Przyciąganie do siatki | przycisk „🧲 Siatka” |
| Zrzut ekranu | 📸 |

## Architektura

```
src/
├── main.ts                 # orkiestracja: budowa UI, podpięcie zdarzeń, koszyk
├── style.css               # motyw i layout aplikacji
├── types.ts                # wspólne typy domenowe
├── data/
│   └── products.ts         # katalog produktów (dane mockowane)
├── furniture/
│   └── factory.ts          # proceduralne modele 3D mebli (bryły Three.js)
└── scene/
    ├── SceneManager.ts     # renderer, kamera, światło, pętla, widok 2D/3D
    ├── Room.ts             # parametryczny pokój (podłoga, ściany, presety)
    └── Planner.ts          # dodawanie, zaznaczanie, drag, obrót, kolor, zapis
```

**Kluczowe decyzje projektowe**

- **Planer = koszyk.** Sceną zakupu jest sam pokój — meble ustawione w 3D tworzą
  listę zamówienia z ceną. To integruje sklep z planerem, zamiast trzymać je osobno.
- **Modele proceduralne.** Każdy mebel to `THREE.Group` złożony z prymitywów, z osią
  `y=0` na podłodze — dzięki temu wstawianie sprowadza się do ustawienia `x/z`.
- **Interakcja bez konfliktów.** Podczas przeciągania mebla `OrbitControls` jest
  chwilowo wyłączany (raycast rozróżnia klik w mebel od klika w tło).
- **Kolizje z pokojem.** Meble są przycinane do wnętrza pokoju z uwzględnieniem obrotu.

## Możliwa rozbudowa

Backend (koszyk/zamówienia w bazie), realne modele `.glb` z CDN, kolizje między
meblami, wymiarowanie i eksport rzutu, konta użytkowników, warianty rozmiarów.
