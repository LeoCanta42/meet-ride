# Meet & Ride 🚗👥

Webapp progressiva (PWA) per il carpooling e la gestione dei passaggi auto per eventi, con ottimizzazione dei posti e dei percorsi.

## ✨ Caratteristiche Implementate

1. **Autenticazione Organizzatori (Basic Auth)**
   - Registrazione e accesso dedicato per gli organizzatori degli eventi.
   - Dashboard personale degli eventi creati con riepilogo in tempo reale di auto, posti disponibili e passeggeri.
   - Creazione, modifica ed eliminazione eventi.

2. **Accesso Partecipanti tramite Link & Password Condivisa**
   - Gli invitati accedono all'evento tramite link diretto (es. `/events/[slug]` o `/events/[id]`).
   - Nessun obbligo di registrazione per i partecipanti: accesso protetto tramite la **password condivisa** impostata dall'organizzatore.
   - Salvataggio locale della sessione per non dover reinserire la password ad ogni ricaricamento.

3. **Ruoli Partecipanti: Guidatori & Passeggeri**
   - **Guidatore (Rider)**:
     - Dati auto (modello, targa/descrizione)
     - Numero di posti passeggeri disponibili
     - Luogo/zona di partenza e orario indicativo
     - Recapito telefonico opzionale
   - **Passeggero (Simple User)**:
     - Punto di ritrovo richiesto
     - Note personali (es. bagagli ingombranti, flessibilità)
     - Scelta manuale del guidatore con cui viaggiare (con visualizzazione dei posti liberi e occupati).

4. **Visualizzazione Posti Auto & Scelta Guidatore**
   - Schede auto interattive con indicatori visivi per ogni posto:
     - Sedile guidatore
     - Posti occupati con i nomi dei passeggeri a bordo
     - Slot liberi per salire a bordo
   - Azioni a 1-click per salire a bordo ("Sali a bordo") o cambiare auto ("Lascia quest'auto").

5. **Ottimizzatore Intelligente Posti & Posizioni (First Version)**
   - Algoritmo che analizza la prossimità geografica (distanza in km o vicinanza testuale del punto di ritrovo/partenza) e la capienza residua dei veicoli.
   - Finestra di anteprima delle raccomandazioni con indicazione del risparmio di chilometri.
   - Applicazione automatica dei suggerimenti con un clic ("Applica Suggerimenti").

6. **Bilingue (Italiano & Inglese)**
   - Switch immediato della lingua (`IT` / `EN`) dalla barra di navigazione con reattività istantanea.

7. **PWA (Progressive Web App)**
   - Supporto completo offline con Workbox e Service Worker.
   - Web App Manifest per l'installazione su smartphone (Android / iOS) e desktop.
   - Banner di installazione integrato.

---

## 🚀 Come Avviare l'Applicazione

### Sviluppo
```bash
npm install
npm run dev
```
Apri il browser su `http://localhost:3000`.

### Build di Produzione
```bash
npm run build
node .output/server/index.mjs
```

---

## 🎿 Evento Demo Precaricato

L'app include già un evento demo pre-configurato per testare immediatamente tutte le funzionalità:
- **Evento**: *Weekend Sci e Relax a Courmayeur*
- **URL**: `http://localhost:3000/events/courmayeur-weekend`
- **Password Condivisa**: `neve`
- **Account Organizzatore Demo**:
  - Email: `organizzatore@meetride.local`
  - Password: `password123`
