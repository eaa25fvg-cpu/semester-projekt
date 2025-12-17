# BeatBazar — Semesterprojekt

Kort beskrivelse  
BeatBazar er en simpel web‑app hvor venner kan oprette et fælles "rum" og lytte til musik sammen. Brugere kan deltage, stemme for at skippe sange, like/dislike og påvirke næste sang med valg af genre/tempo/mood.

Hurtig start (kort)
1. Klon repoet:
   git clone https://github.com/eaa25fvg-cpu/semester-projekt.git
2. Frontend: Åbn `frontend/index.html` eller `frontend/join-room.html` i din browser for en lokal demo.  
3. Backend (valgfrit, kræver PostgreSQL og .env):
   - Opsæt .env med databaseoplysninger (PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD).  
   - Kør: npm install && node backend/server.js

Nøglefunktioner
- Opret og deltag i rum (vælg tema).
- Fælles afspilningskø med visuel progressbar.
- Skip‑afstemning baseret på aktive lyttere.
- Like / dislike og event‑feed (hvem gjorde hvad).
- Brugervalg gemmes og påvirker kommende sangvalg.

Teknologier
- Frontend: HTML, CSS, JavaScript (vanilla)
- Backend: Node.js + Express
- Database: PostgreSQL (data importeres fra CSV)

Bemærk
- Repoet indeholder CSV’er til at oprette databasen (`db/createDb.js`).
- For fuld funktionalitet skal backend køre og være forbundet til en PostgreSQL‑database.

Licence / Kontakt  
Angiv licens i `LICENSE` eller kontakt projektgruppen for spørgsmål.
