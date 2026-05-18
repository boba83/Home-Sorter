# Home Sorter (nezavisna verzija)

Aplikacija za predstavnike na destinaciji — **bez Base44**. Podaci su u **vašoj SQLite bazi** na vašem računaru.

## Šta imate

- **Frontend:** React + Vite (`localhost:5173`)
- **Backend:** Node + Express + Prisma (`localhost:3001`)
- **Baza:** `server/dev.db` (SQLite fajl — možete backupovati/kopirati)

## Prvo pokretanje

```powershell
cd "c:\Users\Admin\Home-Sorter"
npm install
npm install --prefix server
npm run setup:server
```

Ovo kreira bazu i admin nalog:
- **Email:** `admin@home-sorter.local`
- **Lozinka:** `admin123`

Ako dobijete **Port already in use** (3001 ili 5173), u korenu projekta:

```powershell
npm run ports:free
npm run dev:all
```

Ili jednom: `npm run dev:all:clean`

## Svakodnevno pokretanje

Dva terminala:

**Terminal 1 — API:**
```powershell
npm run dev:server
```

**Terminal 2 — aplikacija:**
```powershell
npm run dev
```

Otvorite **http://localhost:5173/login** i prijavite se.

Ili jedna komanda (API + Vite; **ne** pokreće Prisma svaki put — izbegava grešku `EPERM` na Windowsu ako je drugi Node zaključao DLL):

```powershell
npm run dev:all
```

Posle ažuriranja Prisma šeme ili prvog kloniranja, jednom:

```powershell
npm run dev:setup
```

## PDF import

PDF se šalje na **vaš server** (`/api/import/pdf`). Parsiranje je osnovno (tekst iz PDF-a), ne Base44 AI. Za složene PDF-ove možda treba ručno dopuniti podatke posle uvoza.

## Produkcija kasnije

- Hostujte `server/` na VPS-u sa PostgreSQL (promena u `schema.prisma`)
- Build frontenda: `npm run build` → servirajte `dist/` preko nginx-a
- Promenite `JWT_SECRET` i admin lozinku u `server/.env`

## Nema više veze sa Base44

- Nema `app.base44.com` prijave
- Nema mesečne platforme
- Svi podaci su kod vas u `server/dev.db`
