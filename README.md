# Home Sorter (nezavisna verzija)

Aplikacija za predstavnike na destinaciji — **bez Base44**. Podaci su u **vašoj SQLite bazi** na vašem računaru.

## Šta imate

- **Frontend:** React + Vite (`localhost:5173`)
- **Backend:** Node + Express + Prisma (`localhost:3001`)
- **Baza:** `server/dev.db` (SQLite fajl — možete backupovati/kopirati)

## Prvo pokretanje

```powershell
cd "c:\Users\sea_b\Home sorter projekat"
npm install
npm install --prefix server
npm run setup --prefix server
```

Ovo kreira bazu i admin nalog:
- **Email:** `admin@home-sorter.local`
- **Lozinka:** `admin123`

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

Ili jedna komanda (ako imate `concurrently`):
```powershell
npm install
npm run dev:all
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
