# NegaLink — landing strana (plain HTML/CSS/JS)

Statička verzija NegaLink landing strane bez build alata, framework-a i
zavisnosti. Isti dizajn kao React verzija u `../negalink-website`, ali sa
jednostavnijim runtime-om.

> React verzija je ostala netaknuta u `negalink-website/`. Ovaj folder je
> samostalan statički sajt i može se deployovati na bilo koji static hosting.

---

## Pokretanje lokalno

Pošto nema build koraka, dovoljan je bilo koji statički server:

```bash
# Python (macOS/Linux)
python3 -m http.server 4173

# ili Node
npx serve .
```

Zatim otvori `http://localhost:4173/`.

> Otvaranje `index.html` direktno preko `file://` radi za prikaz, ali je
> preporučen server zbog konzistentnog ponašanja i relativnih putanja.

---

## Struktura

```
negalink-website-static/
├── index.html                  # landing strana
├── mogucnosti.html             # stranica sa svim mogućnostima aplikacije
├── css/
│   ├── styles.css              # zajednički stilovi (brend, header, footer, landing)
│   ├── pricing.css             # paketi i cene
│   ├── hero-demo.css           # hero carousel (shell) + rezervni prikaz beleške
│   ├── admin-demo.css          # ilustrativni admin dashboard (beleške smene)
│   ├── ckiti-demo.css          # Ckiti: statistika, zadaci, akcije + KPI interakcija
│   └── mogucnosti.css          # stilovi stranice „Mogućnosti“
├── js/
│   └── main.js                 # hero animacije, interaktivna smena, godina i forma
├── assets/
│   ├── negalink-logo.png
│   ├── negalink-logo-light.png
│   └── djordje.jpg              # portret osnivača (1064×1600, optimizovan)
├── favicon.ico / apple-touch-icon.png / logo192.png / logo512.png
├── manifest.json
├── robots.txt / sitemap.xml
├── staticwebapp.config.json    # CSP + sigurnosni headeri za Azure SWA
└── README.md
```

---

## Kako radi

- **Bez framework-a i bez build-a** — HTML, CSS i jedan `main.js`.
- **Dve stranice** — `index.html` (landing) i `mogucnosti.html` (pregled svih
  modula aplikacije) sa zajedničkim headerom i footerom.
- **Sticky header** — zaglavlje ostaje na vrhu pri skrolovanju, a
  `scroll-padding-top` (i mobilni override) sprečava da cilj anchor linka
  završi ispod njega. `css/mogucnosti.css`, `css/pricing.css`,
  `css/hero-demo.css`, `css/admin-demo.css` i `css/ckiti-demo.css` se učitavaju
  na obe strane kako bi stilovi bili spremni i posle navigacije bez reload-a.
- **Ckiti — interaktivni hero carousel** — pored naslova su četiri prikaza
  (`01 / 04` do `04 / 04`): pregled doma (podrazumevano), statistika doma,
  zadaci danas i potrebne akcije. Prebacivanje je strelicama ili
  `ArrowLeft`/`ArrowRight`; neaktivni slajd je `hidden`. Na pregledu doma KPI
  kartice „Popunjenost“, „Zadaci danas“ i „Potrebne akcije“ vode direktno na
  odgovarajući prikaz, a dugme „Pregled doma“ se vraća nazad.
- **Admin pregled doma** — KPI kartice i panel „Trenutno u smeni“; panel
  beleški se otvori, skeleton zameni lista i važna beleška se istakne.
- **Statistika doma** — prikaz po uzoru na `ResidentStats` / `HomeStatsPanel`
  iz aplikacije: hero „92% / Popunjenost doma“, četiri kartice kapaciteta,
  donut „Popunjenost kreveta“ i kolone „Pokretljivost stanara“.
- **Mobilni Ckiti** — na ≤800px kartica raste sa sadržajem: KPI kartice su
  2×2, prikazuju se oba grafikona, svi zadaci i obe akcije; admin beleške su
  odmah otvorene, bez animacije, da bi visina ostala stabilna.
- **Zadaci danas** — 24 zadatka, segmentirana traka statusa i lista zadataka
  (završeno, u toku, na rasporedu, dodeljeno).
- **Potrebne akcije** — dve akcije iz backend detekcije
  (`ActionNeededDetectionService`): „Dodeliti plan ishrane“
  (`ResidentHasNoDiet`) i „Kreirati zdravstveni karton“
  (`ResidentHasNoHealthRecord`), sa punim imenom korisnika. Obe su `Critical`.
- **Rezervni prikaz dodavanja beleške** — ranija animacija je sačuvana u
  HTML-u van Ckiti niza (nije deo `01 / 04` carousel-a).
- Animacije se pauziraju kada je tab sakriven, a uz `prefers-reduced-motion`
  prikazuju samo konačno stanje. Tekst koji se kuca je `data-note-text` u
  `index.html`; carousel je u `js/main.js` (`initHeroCarousel`), a admin
  animacija u `initAdminDemo`.
- **Pre priče osnivača** — kratka tamna sekcija „Tri stvari koje svaki dom
  zna napamet“ (rasute informacije, dupli upisi, primopredaja) uvodi priču
  osnivača; bez izmišljenih brojeva i statistika.
- **Priča osnivača** — portret Đorđa Đukića i kratka priča o tome kako je
  NegaLink nastao uz mlade entuzijaste iz doma „Naša Čuvarkuća“ u Bečeju.
- **Paketi i cene** — tri mesečna paketa (Starter 15.000, Standard 22.000,
  Enterprise 36.000 RSD) sa rasponima aktivnih korisnika; prvih mesec dana
  korišćenja je besplatno, a pretplata se može otkazati u svakom trenutku.
  CTA „Izaberite ...“ vodi na kontakt formu. Stilovi su u `css/pricing.css`.
- **CTA-ovi** — „Povežite svoj dom“ u headeru i heroju vodi na `#prijava`,
  „Izaberite ...“ na paketima takođe vodi na kontakt formu, a forma ima
  „Pošaljite upit“.
- **Mapa oblasti (Mogućnosti)** — devet polja u heroju su linkovi ka
  odgovarajućim sekcijama ispod; skrolovanje je glatko i poštuje sticky
  header preko `scroll-padding-top`. Bez JavaScripta linkovi rade kao obični
  anchori.
- **Mobilni meni** — ispod 800px header prikazuje hamburger; panel sadrži
  Početna, Mogućnosti i CTA „Povežite svoj dom“; CTA iz headera je na
  mobilnom sakriven i dostupan u meniju. Podržava `aria-expanded`/
  `aria-controls`, zatvaranje na Escape, klik van menija i pri promeni
  stranice. Link „Cene“ je uklonjen iz navigacije.
- **Navigacija bez ponovnog učitavanja** — `js/main.js` pri kliku na interni
  link menja samo `<main>`; header i footer se ne rekonstruišu, pa top bar
  bukvalno ostaje na mestu (nema treperenja pri promeni stranica). Skrol na
  novoj strani kreće od vrha ili od `#hash` cilja, a `aria-current` se
  ažurira na aktivnu stavku. Ako JavaScript nije dostupan, linkovi rade kao
  obična navigacija između HTML fajlova.
- **Animiran prelaz između stranica** — stara strana kratko izbledi i pomeri
  se u smeru navigacije (Početna → Mogućnosti ide napred, nazad obrnuto),
  nova uđe iz tog smera, a hero sadržaj se blago podigne uz blagi stagger.
  Animira se samo `<main>`; `prefers-reduced-motion` je u potpunosti
  isključuje. Isti efekat radi i kada se HTML otvori direktno preko
  `file://` — tada se posle animiranog izlaza nova strana učitava klasično,
  a ulazna animacija se pokreće pri njenom učitavanju.
- **Interaktivna smena** — klik na 07:00 / 11:30 / 15:00 menja ilustrativni
  prikaz na desktopu. Na mobilnom su sva tri prikaza vidljiva ispod svojih
  trenutaka. Drugi prikaz (11:30) ima interaktivne tabove **Zadaci /
  Raspored / Beleške**: Raspored prikazuje mini mesečni kalendar, a Beleške
  listu beleški smene, po uzoru na aplikaciju. Bez JavaScripta desktop
  prikazuje prvi demo.
- **Kontakt forma** — validira naziv doma i email, prikazuje greške i otvara
  korisnikov email klijent preko `mailto:` linka. Podaci se ne čuvaju na sajtu.
- **Godina u footeru** — `main.js` je postavlja na trenutnu godinu, uz statički
  fallback `2026`.
- **Pristupačnost** — skip-link, vidljiv fokus, `aria-pressed` na momentima,
  `aria-live` na demo panelu, povezani labeli i `aria-invalid` na poljima,
  `aria-roledescription="carousel"`, KPI kartice kao prava dugmad, labele na
  strelicama, fokus na „Pregled doma“ posle prelaska i `aria-live` najava
  promene slajda; poštovanje `prefers-reduced-motion`.

---

## Izmena sadržaja

Sav tekst je direktno u HTML fajlovima:

1. Hero (oba carousel prikaza), trenuci smene, demo zadaci, priča i forma —
   `index.html`.
2. Sadržaj stranice sa mogućnostima — `mogucnosti.html`.
3. Boje, tipografija i layout — CSS promenljive na početku `css/styles.css`.
4. Kontakt email za formu — `data-contact-email` na `<form>` elementu; po
   potrebi i `href` fallback linkovi u formi.
5. Fotografija osnivača — `assets/djordje.jpg` (1064×1600). Okvir u
   `css/styles.css` (`.story-photo`) ima isti odnos strana (2:3) i maksimalnu
   širinu 440px, pa se cela slika vidi bez krojenja. Za zamenu stavi novu sliku
   u `assets/` i promeni `src`/`alt` u `index.html`.
6. Cene i paketi — sekcija `#paketi` u `index.html`; iznosi i rasponi su u
   `.price-card__price` / `.price-card__range`, a stilovi u `css/pricing.css`.
7. Logo — zameni `assets/negalink-logo.png` (i favicon/logo fajlove po potrebi).

> **Verzionisanje asseta:** kada menjaš `css/*.css` ili `js/main.js`, povećaj
> `?v=` u `index.html` i `mogucnosti.html` (npr. `styles.css?v=4`) da bi
> pregledači odmah povukli novu verziju, bez keširanog starog fajla.
>
> Sadržaj Ckiti prikaza (KPI, statistika, zadaci, akcije, beleške) je direktno
> u `index.html`. Animacije su u `css/admin-demo.css` i `css/ckiti-demo.css`;
> carousel i admin animacija su u `js/main.js` (`initHeroCarousel`,
> `initAdminDemo`).

---

## SEO

- `index.html` sadrži title, description, canonical, Open Graph i Twitter meta
  tagove.
- `robots.txt` dozvoljava indeksiranje, `sitemap.xml` sadrži početnu stranu.
- **Ako se domen promeni**, ažurirati canonical/OG URL-ove, `robots.txt`,
  `sitemap.xml` i `manifest.json` po potrebi.
- `og:image` trenutno koristi `logo512.png`. Preporuka: dodati namensku
  `1200×630` sliku.

---

## Deploy

Sajt je potpuno statičan — dovoljno je uploadovati sadržaj foldera na hosting
(Azure Static Web Apps, Netlify, GitHub Pages, Nginx...).

Za **Azure Static Web Apps**:

- `app_location` je koren foldera,
- nema build komande (`npm run build` nije potreban),
- `staticwebapp.config.json` se automatski primenjuje i sadrži CSP i sigurnosne
  headere.

Za **Loopia / klasičan shared hosting**:

- uploadovati sadržaj foldera (ne ceo repo) u web root, npr. `public_html`,
- `staticwebapp.config.json` se ignoriše; CSP i sigurnosni headeri se po
  potrebi dodaju kroz `.htaccess`,
- sajt otvarati preko HTTP/HTTPS domena — `file://` ima animacije, ali ne i
  soft navigaciju bez reload-a.

Ako se koristi CI/CD, dovoljan je korak koji kopira folder na hosting; nema
`node_modules`, bundlera ni artefakata.

---

## Poznata ograničenja

- **Bez JavaScripta** forma ne šalje podatke (postoji `noscript` uputstvo sa
  kontakt mejlom), a desktop demo ostaje na prvom prikazu. Hero tada prikazuje
  samo prvi (admin) slajd; KPI kartice, strelice i detaljni prikazi ne rade.
  Prelasci između stranica tada rade kao klasično učitavanje dokumenata, bez
  „bez reload-a“ ponašanja opisanog iznad.
- **Forma ne čuva podatke** — otvara email klijent (`mailto`).
- **Cene na sajtu i backend billing nisu usklađene** — sajt prikazuje nova tri
  paketa (15.000 / 22.000 / 36.000 RSD), a backend seed još ima četiri paketa
  (16.999 / 22.999 / 39.999 / 49.999 RSD, uključujući Enterprise Plus).
  Potrebno je uskladiti migracijom i ukloniti Enterprise Plus.
- **Hero prikaz je ilustrativni demo**, ne snimak stvarnog proizvoda; KPI
  brojevi, imena i beleške su ilustrativni.
- Nema analitike; po potrebi dodati skript i proširiti CSP u
  `staticwebapp.config.json`.
