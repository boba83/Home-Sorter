# Live: astratravel-sitonija.com (Home Sorter)

Preporučeni **besplatni** (ili skoro besplatni) stack:

| Deo | Servis | Cena |
|-----|--------|------|
| **Sajt (React)** | [Vercel](https://vercel.com) | Besplatan hobby plan |
| **API (Node)** | [Render](https://render.com) | Besplatan web service (spava posle neaktivnosti) |
| **Baza** | [Neon](https://neon.tech) | Besplasan PostgreSQL |

**Ne stavljajte API na Vercel** — aplikacija koristi stalni Node server i fajlove (PDF, slike); to ide na Render.

---

## Pregled domena

| Adresa | Šta |
|--------|-----|
| `https://astratravel-sitonija.com` | Frontend (Vercel) |
| `https://www.astratravel-sitonija.com` | Isto (opciono) |
| `https://api.astratravel-sitonija.com` | API (Render) |

Kod registrara domena dodajte DNS zapise koje Vercel i Render pokažu (obično **CNAME**).

---

## Korak 1 — GitHub (već imate)

Repo: **https://github.com/boba83/Home-Sorter**

Vercel i Render se povezuju na GitHub i automatski redeployuju na `git push`.

---

## Korak 2 — Baza (Neon)

1. Registracija na [neon.tech](https://neon.tech) → **New Project**.
2. Kopirajte **connection string** (PostgreSQL, sa `?sslmode=require`).
3. U `server/prisma/schema.prisma` za produkciju promenite:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

   (Lokalno i na Renderu koristite isti Neon connection string u `server/.env` — opciono Neon **dev branch** za test.)

4. Jednom na računaru (sa Neon `DATABASE_URL` u `server/.env`):

   ```powershell
   cd server
   npm install
   npx prisma db push
   node seed.js
   ```

   To kreira tabele i admin: `admin@home-sorter.local` / `admin123` (promenite posle prijave).

---

## Korak 3 — API (Render)

1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Blueprint** (ili Web Service ručno).
2. Povežite repo **boba83/Home-Sorter** (ako koristite `render.yaml` u repou, Render učita podešavanja).
3. Ručno ako treba:
   - **Root Directory:** `server`
   - **Build:** `npm install && npm run build:deploy`
   - **Start:** `npm start`
   - **Health check path:** `/api/health`
4. **Environment variables** (Settings → Environment):

   | Ključ | Vrednost |
   |-------|----------|
   | `DATABASE_URL` | Neon connection string |
   | `JWT_SECRET` | dug random string (npr. 64 znaka) |
   | `APP_URL` | `https://www.astratravel-sitonija.com` |
   | `NODE_VERSION` | `20` |

5. **Custom domain:** Settings → Custom Domains → `api.astratravel-sitonija.com` → dodajte DNS CNAME koji Render prikaže.

6. Sačekajte deploy; otvorite `https://api.astratravel-sitonija.com/api/health` — treba `{"ok":true}`.

---

## Korak 4 — Frontend (Vercel)

1. [vercel.com](https://vercel.com) → **Add New…** → **Project** → import **boba83/Home-Sorter**.
2. **Framework:** Vite  
   **Build Command:** `npm run build`  
   **Output Directory:** `dist`  
   **Install Command:** `npm install`
3. **Environment variables** (Project → Settings → Environment Variables):

   | Ključ | Vrednost |
   |-------|----------|
   | `VITE_API_URL` | `https://api.astratravel-sitonija.com` |

4. **Deploy** → dobijate `*.vercel.app`.
5. **Domains:** Settings → Domains → dodajte `astratravel-sitonija.com` i `www.astratravel-sitonija.com` → podesite DNS kod registrara (Vercel daje tačne zapise).
6. Otvorite `https://astratravel-sitonija.com/login` i prijavite se.

### Drugi projekat na Vercelu kasnije (npr. Astra app)

Isti nalog → **Add New → Project** → drugi Git repo → drugi poddomen (`astra.astratravel-sitonija.com`). Svaki projekat je odvojen.

---

## Korak 5 — Mail za pozivnice (kad budete spremni)

U Render env na API-ju dodajte (primer):

```
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=Home Sorter <invite@astratravel-sitonija.com>
APP_NAME=Home Sorter
```

Koristite mail koji napravite za produkciju (npr. Google Workspace, Zoho, ili SMTP provajder domena).

---

## Šta pošaljete developeru / u chat (bez lozinki u Git-u)

- [ ] Neon **DATABASE_URL** (može u Render env, ne u repo)
- [ ] Da li je **Render** API live (`/api/health`)
- [ ] Da li je **Vercel** povezan na repo i deploy prošao
- [ ] Screenshot DNS zapisa ako domen ne radi
- [ ] Produkcijski admin email / da li menjate seed lozinku

---

## Lokalno vs live

| | Lokalno | Live |
|---|---------|------|
| Frontend | `npm run dev` → :5173 | Vercel |
| API | `npm run dev:server` → :3001 | Render |
| Baza | `server/dev.db` (SQLite) | Neon (PostgreSQL) |
| API URL u browseru | Vite proxy `/api` | `VITE_API_URL` |

---

## Ograničenja besplatnog Rendera

- Servis **usne** posle ~15 min neaktivnosti; prvi zahtev može trajati **30–60 s** (hladan start).
- Za ozbiljniji promet kasnije: Render paid plan ili drugi host.

Neon free: dovoljno za start; pratite limite u dashboardu.
