<div align="center">

# 🚗 Meet & Ride

**Smart Event Carpooling & Intelligent Ride Allocation PWA**

[![Nuxt](https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxt.js&logoColor=white)](https://nuxt.com/)
[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Ready-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini-2.5%20AI-8E75B2?logo=google-gemini&logoColor=white)](https://aistudio.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable-FFA000?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

*Effortlessly coordinate shared car rides for ski trips, weddings, festivals, and parties.*

[Features](#-features) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [Environment Variables](#-environment-variables) • [Demo Event](#-demo-event)

</div>

---

## 📖 Overview

Organizing rides for group events usually ends up in a messy WhatsApp group with lost messages, confused drivers, and empty seats.

**Meet & Ride** provides a frictionless web app where:
1. **Organizers** create an event with a shared password and destination.
2. **Guests** open the link and join without needing to create an account.
3. **Drivers (Riders)** post their car model, available seats, and departure zone.
4. **Passengers** pick their seat with 1 click or request a pickup.
5. **AI Optimization (Gemini)** suggests the most efficient passenger-to-car assignments to minimize detours and fuel consumption.

---

## ✨ Features

### 🚗 Interactive Car Seats & Ride Allocation
- **Visual Car Cards**: Real-time view of every car, driver, passenger names, and remaining seats.
- **1-Click Actions**: Guests can join a car with a single tap or switch cars easily.
- **Unassigned Waiting List**: Clear overview of passengers who still need a ride.

### 🧠 Gemini AI Optimization (Organizer Only)
- Integrates Google's **Gemini 2.5 Flash** to analyze driver departure points, passenger pickup locations, and car capacities.
- Generates optimal ride pairings, estimated distance savings, and rationales.
- **One-Click Apply**: Automatically updates car seat assignments across the event.
- **Access Control**: Strictly restricted to the event creator.

### 📱 Frictionless Guest Model with Secure PIN Sync
- **No Account Required for Guests**: Guests only need the event link and shared password.
- **Secure Cross-Device Recovery**:
  - **4-Digit Secret PIN**: Accessing from a different browser or phone requires the secret PIN chosen during registration (or the personal link). Phone numbers are strictly preserved for passenger contact and coordination, never used as an authentication loophole.
  - **Instant Camera QR Code**: Scan right from your desktop screen with your phone camera to open the event already logged in.
  - **Guided Onboarding Dialog**: Right after joining, guests receive immediate visual confirmation, their personal link, and an overview of their 4-digit PIN.
  - **1-Click Self-Identification**: Tap your name on any car card or waiting list to instantly open the reconnection prompt with your profile pre-selected.
  - **Personal Management Link**: Share your private access URL (`/events/slug?p=token`) or send it to yourself on WhatsApp with 1 click.

### 👑 Full Organizer Event Management
- **Direct Participant Creation**: Organizers can directly add drivers and passengers to the event without overriding their organizer session.
- **Edit & Delete Any Participant**: Full administrative control over any car, seats, departure times, and passenger details.
- **Seat Assignment & Unassignment**: Organizers can manually assign unassigned passengers to specific cars or free up seats with 1 click.

### 🚘 Multi-Vehicle Registration & Driverless Car Hosting
- **Up to 2 Vehicles**: Users can register a primary car and an optional secondary vehicle.
- **Host Car Without Driver**: Community members who own an extra vehicle can make it available for the group even if they are not driving it themselves (`hasDriver: false`), with distinct "Cerca autista" badges and seat counters.

### 🗺️ AI Convoy Track Map & Target Arrival Time (Gemini Powered)
- **Target Arrival Time**: Specify a required destination arrival time (e.g. `20:30`).
- **Interactive Leaflet Route Map**: Visualizes starting locations, calculated meeting/rendezvous points, and destination with OpenStreetMap tiles and polylines.
- **Gemini AI Convoy Engine**: Analyzes driver departure points (e.g. Biancavilla and Belpasso) and automatically determines the optimal convergence meeting point (e.g. Paternò), departure schedules working backward from the arrival time, and step-by-step travel timeline.

### 🔒 Privacy & Password Visibility Controls
- **Eye Toggle Button**: Show/hide passwords across the app (event unlock gate, organizer login, registration, and participant PINs).
- **Edge / Browser Clean**: Standardized reveal styling that suppresses conflicting browser icons.

### 📲 Progressive Web App (PWA)
- Installable on iOS (Safari Add to Home Screen) and Android (Chrome APK/PWA prompt).
- Service Worker offline caching via Workbox for instant load times even in remote areas (e.g. mountain resorts).

### 🌐 Internationalization & Modern Theming
- Instant language toggle (**Italian** / **English**).
- Dark and Light mode support with automatic OS detection.
- Polished micro-interactions using `@nuxt/ui` and `@iconify-json/lucide`.

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | [Nuxt 4](https://nuxt.com/) (Vue 3 + Nitro Engine) |
| **UI Components** | [@nuxt/ui v4](https://ui.nuxt.com/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide Icons](https://lucide.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **AI Engine** | [@google/genai](https://www.npmjs.com/package/@google/genai) (Google Gemini 2.5) |
| **Database** | Dual Mode: [Supabase](https://supabase.com/) (PostgreSQL) or zero-setup local persistent store |
| **PWA** | [@vite-pwa/nuxt](https://vite-pwa-org.netlify.app/) & Workbox |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** `>= 18.x` (or `20.x` recommended)
- **npm** or **pnpm**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/meet-ride.git
cd meet-ride

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```ini
# Optional: Connect to your remote Supabase instance
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-publishable-key
SUPABASE_SERVICE_KEY=your-service-role-secret-key

# Optional: Add your Google Gemini API Key for AI seat optimization
GEMINI_API_KEY=your-gemini-api-key
```

> [!NOTE]
> **Zero-Config Mode**: If Supabase variables are left blank, Meet & Ride automatically boots in **local storage mode** with pre-seeded demo data, allowing you to test right away without setting up any cloud databases.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Type Checking & Production Build
```bash
# Run TypeScript verification
npm run typecheck

# Build for production
npm run build

# Preview production build
node .output/server/index.mjs
```

---

## 🎿 Demo Event

The application includes a pre-seeded demo event ready for testing immediately upon launch:

| Attribute | Demo Value |
| :--- | :--- |
| **Event Name** | *Weekend Sci e Relax a Courmayeur* |
| **Event URL** | `http://localhost:3000/events/courmayeur-weekend` (or short link `/e/courmayeur-weekend`) |
| **Shared Password** | `neve` |
| **Organizer Account** | `organizzatore@meetride.local` |
| **Organizer Password** | `password123` |

---

## 🗄️ Database Setup (Supabase)

If deploying with Supabase:
1. Create a new project in the [Supabase Dashboard](https://supabase.com/).
2. Open the **SQL Editor** in your Supabase project.
3. Run the complete idempotent schema script located in [`supabase/schema.sql`](supabase/schema.sql).
4. Paste your project URL and API keys into `.env`.

---

## 📁 Project Structure

```text
meet-ride/
├── app/
│   ├── assets/css/          # TailwindCSS theme, accent palettes & global styles
│   ├── components/          # Vue components (CarCard, OptimizationPanel, Modals, Navbar)
│   ├── composables/         # Composable logic (useEvent, useOrganizerAuth, useI18n, usePwa)
│   ├── pages/               # Nuxt file-based routing
│   │   ├── events/
│   │   │   ├── [id].vue     # Main event page (car cards, passenger allocation)
│   │   │   └── new.vue      # Create new event
│   │   ├── e/[slug].vue     # Clean short-link redirector
│   │   ├── login.vue        # Organizer sign in
│   │   └── register.vue     # Organizer sign up
│   └── types/               # TypeScript interfaces & Supabase type definitions
├── server/
│   ├── api/                 # Nitro server endpoints (auth, events, participants, AI optimizer)
│   └── utils/               # Server helpers (Supabase client, Gemini optimizer, JWT/Auth)
├── supabase/
│   └── schema.sql           # PostgreSQL idempotent schema
├── public/                  # PWA icons, manifest & static assets
└── nuxt.config.ts           # Nuxt configuration
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
