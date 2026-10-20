export type Locale = 'it' | 'en'

const translations = {
  it: {
    common: {
      appName: 'Meet & Ride',
      save: 'Salva',
      cancel: 'Annulla',
      delete: 'Elimina',
      edit: 'Modifica',
      create: 'Crea',
      loading: 'Caricamento...',
      confirm: 'Conferma',
      back: 'Indietro',
      copy: 'Copia link',
      copied: 'Link copiato negli appunti!',
      close: 'Chiudi',
      or: 'oppure',
      required: 'Obbligatorio',
      optional: 'Opzionale',
      search: 'Cerca...',
      all: 'Tutti',
      success: 'Operazione completata con successo',
      error: 'Si è verificato un errore'
    },
    nav: {
      home: 'Home',
      myEvents: 'I miei Eventi',
      newEvent: 'Nuovo Evento',
      login: 'Accedi',
      register: 'Registrati',
      logout: 'Esci',
      theme: 'Tema',
      language: 'Lingua'
    },
    hero: {
      badge: 'Carpooling per Eventi Intelligente',
      title: 'Organizza i passaggi in auto per i tuoi eventi',
      subtitle: 'Crea un evento, condividi il link con gli invitati e lascia che guidatori e passeggeri si organizzino facilmente, ottimizzando i posti auto e le partenze.',
      createEventBtn: 'Crea un Evento',
      howItWorksBtn: 'Come funziona',
      joinBoxTitle: 'Hai un link o codice evento?',
      joinBoxPlaceholder: 'Incolla link o codice evento...',
      joinBoxBtn: 'Partecipa',
      feature1Title: 'Accesso Semplice con Password',
      feature1Desc: 'Gli invitati non devono registrarsi: basta il link dell\'evento e la password condivisa.',
      feature2Title: 'Guidatori & Passeggeri',
      feature2Desc: 'Chi ha un\'auto indica posti e luogo di partenza; i passeggeri scelgono l\'auto più comoda.',
      feature3Title: 'Ottimizzazione Posti & Percorsi',
      feature3Desc: 'Algoritmo che aiuta ad allocare i passeggeri nelle auto più vicine per ridurre deviazioni e sprechi.'
    },
    auth: {
      loginTitle: 'Accedi come Organizzatore',
      loginSubtitle: 'Gestisci i tuoi eventi e visualizza le auto',
      registerTitle: 'Crea Account Organizzatore',
      registerSubtitle: 'Inizia subito a organizzare passaggi per i tuoi raduni',
      email: 'Email',
      password: 'Password',
      name: 'Nome e Cognome',
      namePlaceholder: 'es. Mario Rossi',
      loginSubmit: 'Accedi',
      registerSubmit: 'Registrati',
      noAccount: 'Non hai un account? Registrati',
      hasAccount: 'Hai già un account? Accedi',
      loginSuccess: 'Bentornato!',
      registerSuccess: 'Account creato con successo!'
    },
    events: {
      title: 'Titolo Evento',
      titlePlaceholder: 'es. Gita in Montagna a Courmayeur',
      description: 'Descrizione / Note',
      descriptionPlaceholder: 'Dettagli su programma, ritrovo, pranzo...',
      destination: 'Destinazione dell\'Evento',
      destinationPlaceholder: 'es. Courmayeur, Piazza Abbé Henry',
      date: 'Data e Ora dell\'Evento',
      sharedPassword: 'Password Condivisa Evento',
      sharedPasswordPlaceholder: 'es. courmayeur2026',
      sharedPasswordHelp: 'Tutti i partecipanti useranno questa password per entrare nell\'evento.',
      createTitle: 'Crea Nuovo Evento',
      createSubtitle: 'Imposta i dettagli e la password d\'accesso per gli invitati',
      createSubmit: 'Crea Evento & Ottieni Link',
      editTitle: 'Modifica Evento',
      deleteConfirm: 'Sei sicuro di voler eliminare questo evento? Tutti i passaggi registrati verranno cancellati.',
      shareTitle: 'Condividi con i Partecipanti',
      shareText: 'Invia questo link e la password ai partecipanti dell\'evento:',
      copySuccess: 'Link copiato!',
      openPublicLink: 'Apri pagina pubblica'
    },
    dashboard: {
      title: 'I Tuoi Eventi',
      subtitle: 'Tutti gli eventi che hai organizzato',
      emptyTitle: 'Nessun evento creato',
      emptyDesc: 'Crea il tuo primo evento per iniziare ad assegnare i posti auto agli invitati.',
      createNew: 'Crea Evento',
      statTotalEvents: 'Eventi Totali',
      statUpcoming: 'In Programma',
      statRiders: 'Guidatori Totali'
    },
    eventView: {
      date: 'Data',
      destination: 'Destinazione',
      sharedPasswordRequired: 'Questo evento è protetto',
      passwordPrompt: 'Inserisci la password condivisa fornita dall\'organizzatore per visualizzare e partecipare ai passaggi.',
      unlockBtn: 'Sblocca Evento',
      wrongPassword: 'Password non corretta. Riprova.',
      statsTitle: 'Riepilogo Passaggi',
      statCars: 'Auto Disponibili',
      statTotalSeats: 'Posti Totali',
      statOccupied: 'Posti Occupati',
      statAvailable: 'Posti Liberi',
      statUnassigned: 'In Attesa di Auto',
      carsTitle: 'Auto & Guidatori',
      noCarsYet: 'Nessun guidatore registrato al momento. Offri la tua auto per primo!',
      unassignedTitle: 'Passeggeri in Attesa di Assegnazione',
      noUnassigned: 'Tutti i passeggeri hanno trovato un posto in auto! 🎉',
      imDriving: '🚗 Offro un\'auto',
      iNeedRide: '🙋 Cerco un passaggio',
      myStatus: 'La tua partecipazione:',
      editParticipation: 'Modifica i miei dati',
      leaveParticipation: 'Rimuovi la mia presenza',
      leaveConfirm: 'Vuoi davvero cancellare la tua registrazione da questo evento?'
    },
    car: {
      driver: 'Guidatore',
      seats: 'posti disponibili',
      seatsFull: 'Auto al completo',
      departure: 'Partenza da',
      departureTime: 'Orario',
      passengersList: 'Passeggeri a bordo',
      noPassengersYet: 'Nessun passeggero a bordo',
      joinCarBtn: 'Sali a bordo',
      leaveCarBtn: 'Lascia quest\'auto',
      youAreInThisCar: 'Sei a bordo di quest\'auto',
      youAreTheDriver: 'Sei il guidatore di quest\'auto',
      contact: 'Contatto'
    },
    participantModal: {
      titleJoin: 'Partecipa all\'Evento',
      titleEdit: 'Modifica la tua partecipazione',
      roleQuestion: 'Come vuoi partecipare?',
      roleRider: 'Offro un passaggio (Guidatore)',
      roleRiderDesc: 'Ho un\'auto con dei posti disponibili e posso dare passaggi',
      rolePassenger: 'Cerco un passaggio (Passeggero)',
      rolePassengerDesc: 'Non guido e ho bisogno di un posto in auto da un punto di ritrovo',
      nameLabel: 'Il tuo Nome',
      namePlaceholder: 'es. Luca Bianchi',
      phoneLabel: 'Telefono / WhatsApp',
      phonePlaceholder: 'es. +39 333 1234567',
      carModelLabel: 'Modello Auto',
      carModelPlaceholder: 'es. Fiat Tipo 5 porte Grigia',
      totalSeatsLabel: 'Posti Passeggeri Disponibili',
      totalSeatsHelp: 'Escluso il guidatore (es. 4 posti)',
      departureLocationLabel: 'Luogo / Zona di Partenza',
      departureLocationPlaceholder: 'es. Milano Lambrate FS o Via Palmanova',
      departureTimeLabel: 'Orario indicativo di partenza',
      departureTimePlaceholder: 'es. 08:30',
      pickupLocationLabel: 'Da dove hai bisogno del passaggio?',
      pickupLocationPlaceholder: 'es. Milano Loreto o Stazione Centrale',
      notesLabel: 'Note aggiuntive',
      notesPlaceholder: 'es. Ho una valigia grande, flessibile sull\'orario...',
      submitRider: 'Conferma come Guidatore',
      submitPassenger: 'Conferma come Passeggero'
    },
    optimizer: {
      title: 'Ottimizzatore Intelligente Posti',
      subtitle: 'Assegna automaticamente i passeggeri alle auto più vicine',
      explanation: 'L\'algoritmo analizza le posizioni di partenza dei guidatori e i punti di ritrovo dei passeggeri, massimizzando il riempimento dei veicoli e minimizzando le deviazioni.',
      runBtn: 'Calcola Allocazione Ottimale',
      applyBtn: 'Applica Suggerimenti',
      noSuggestions: 'L\'allocazione attuale è già ottimizzata oppure non ci sono passeggeri da riassegnare.',
      suggestionsFound: 'suggerimenti trovati per ottimizzare i posti auto:',
      assignPassenger: 'Assegna passeggero',
      toCar: 'all\'auto di',
      reasonProximity: 'Partenza vicina / percorso compatibile',
      reasonCapacity: 'Auto con posti liberi',
      appliedSuccess: 'Allocazione posti applicata con successo!'
    },
    pwa: {
      installTitle: 'Installa Meet & Ride',
      installDesc: 'Aggiungi alla schermata home per accedere rapidamente ai tuoi passaggi anche offline.',
      installBtn: 'Installa App',
      dismissBtn: 'Non ora'
    }
  },
  en: {
    common: {
      appName: 'Meet & Ride',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      loading: 'Loading...',
      confirm: 'Confirm',
      back: 'Back',
      copy: 'Copy link',
      copied: 'Link copied to clipboard!',
      close: 'Close',
      or: 'or',
      required: 'Required',
      optional: 'Optional',
      search: 'Search...',
      all: 'All',
      success: 'Action completed successfully',
      error: 'An error occurred'
    },
    nav: {
      home: 'Home',
      myEvents: 'My Events',
      newEvent: 'New Event',
      login: 'Sign In',
      register: 'Sign Up',
      logout: 'Log Out',
      theme: 'Theme',
      language: 'Language'
    },
    hero: {
      badge: 'Smart Event Carpooling',
      title: 'Organize car rides for your events effortlessly',
      subtitle: 'Create an event, share the link with guests, and let drivers and passengers organize their car seats based on departure location and availability.',
      createEventBtn: 'Create an Event',
      howItWorksBtn: 'How it works',
      joinBoxTitle: 'Have an event link or code?',
      joinBoxPlaceholder: 'Paste event link or code...',
      joinBoxBtn: 'Join',
      feature1Title: 'Simple Password Access',
      feature1Desc: 'Guests don\'t need to sign up: just open the link and enter the shared event password.',
      feature2Title: 'Drivers & Passengers',
      feature2Desc: 'Car hosts list their available seats and departure spots; passengers pick the best ride.',
      feature3Title: 'Seat & Route Optimization',
      feature3Desc: 'Smart allocation algorithm that pairs passengers with nearby drivers to minimize detours.'
    },
    auth: {
      loginTitle: 'Organizer Sign In',
      loginSubtitle: 'Manage your events and review carpools',
      registerTitle: 'Create Organizer Account',
      registerSubtitle: 'Start organizing shared rides for your events',
      email: 'Email',
      password: 'Password',
      name: 'Full Name',
      namePlaceholder: 'e.g. John Doe',
      loginSubmit: 'Sign In',
      registerSubmit: 'Sign Up',
      noAccount: 'Don\'t have an account? Sign up',
      hasAccount: 'Already have an account? Sign in',
      loginSuccess: 'Welcome back!',
      registerSuccess: 'Account created successfully!'
    },
    events: {
      title: 'Event Title',
      titlePlaceholder: 'e.g. Mountain Weekend in Courmayeur',
      description: 'Description / Notes',
      descriptionPlaceholder: 'Details on schedule, meeting point, food...',
      destination: 'Event Destination',
      destinationPlaceholder: 'e.g. Courmayeur, Main Square',
      date: 'Event Date & Time',
      sharedPassword: 'Event Shared Password',
      sharedPasswordPlaceholder: 'e.g. courmayeur2026',
      sharedPasswordHelp: 'All guests will use this password to access the event page.',
      createTitle: 'Create New Event',
      createSubtitle: 'Set event details and a shared password for your guests',
      createSubmit: 'Create Event & Get Link',
      editTitle: 'Edit Event',
      deleteConfirm: 'Are you sure you want to delete this event? All registered rides will be removed.',
      shareTitle: 'Share with Participants',
      shareText: 'Send this link and password to your participants:',
      copySuccess: 'Link copied!',
      openPublicLink: 'Open public page'
    },
    dashboard: {
      title: 'Your Events',
      subtitle: 'All events you have organized',
      emptyTitle: 'No events created yet',
      emptyDesc: 'Create your first event to start assigning car seats to guests.',
      createNew: 'Create Event',
      statTotalEvents: 'Total Events',
      statUpcoming: 'Upcoming',
      statRiders: 'Total Drivers'
    },
    eventView: {
      date: 'Date',
      destination: 'Destination',
      sharedPasswordRequired: 'This event is protected',
      passwordPrompt: 'Enter the shared password provided by the organizer to view and join carpools.',
      unlockBtn: 'Unlock Event',
      wrongPassword: 'Incorrect password. Please try again.',
      statsTitle: 'Carpool Overview',
      statCars: 'Available Cars',
      statTotalSeats: 'Total Seats',
      statOccupied: 'Seats Taken',
      statAvailable: 'Seats Left',
      statUnassigned: 'Waiting for a Ride',
      carsTitle: 'Cars & Drivers',
      noCarsYet: 'No drivers registered yet. Be the first to offer a ride!',
      unassignedTitle: 'Passengers Waiting for a Ride',
      noUnassigned: 'All passengers have a seat in a car! 🎉',
      imDriving: '🚗 I can drive (Offer ride)',
      iNeedRide: '🙋 I need a ride',
      myStatus: 'Your registration:',
      editParticipation: 'Edit my details',
      leaveParticipation: 'Leave this event',
      leaveConfirm: 'Do you really want to cancel your registration for this event?'
    },
    car: {
      driver: 'Driver',
      seats: 'seats left',
      seatsFull: 'Car Full',
      departure: 'Departing from',
      departureTime: 'Time',
      passengersList: 'Passengers on board',
      noPassengersYet: 'No passengers in this car yet',
      joinCarBtn: 'Join this car',
      leaveCarBtn: 'Leave this car',
      youAreInThisCar: 'You are riding in this car',
      youAreTheDriver: 'You are driving this car',
      contact: 'Contact'
    },
    participantModal: {
      titleJoin: 'Join Event Carpool',
      titleEdit: 'Edit your registration',
      roleQuestion: 'How would you like to participate?',
      roleRider: 'I can drive (Car Host)',
      roleRiderDesc: 'I have a car with available passenger seats and can offer rides',
      rolePassenger: 'I need a ride (Passenger)',
      rolePassengerDesc: 'I need a seat in a car from a pickup location',
      nameLabel: 'Your Name',
      namePlaceholder: 'e.g. Alex Smith',
      phoneLabel: 'Phone / WhatsApp',
      phonePlaceholder: 'e.g. +1 555 123 4567',
      carModelLabel: 'Car Model / Color',
      carModelPlaceholder: 'e.g. Blue VW Golf (5 seats)',
      totalSeatsLabel: 'Available Passenger Seats',
      totalSeatsHelp: 'Excluding the driver (e.g. 4 seats)',
      departureLocationLabel: 'Departure Area / Pickup Spot',
      departureLocationPlaceholder: 'e.g. Central Station or North Metro',
      departureTimeLabel: 'Estimated Departure Time',
      departureTimePlaceholder: 'e.g. 08:30 AM',
      pickupLocationLabel: 'Where do you need a pickup?',
      pickupLocationPlaceholder: 'e.g. South Station or Downtown',
      notesLabel: 'Additional Notes',
      notesPlaceholder: 'e.g. I have a big suitcase, flexible on timing...',
      submitRider: 'Confirm as Driver',
      submitPassenger: 'Confirm as Passenger'
    },
    optimizer: {
      title: 'Smart Seat Optimizer',
      subtitle: 'Automatically pair passengers with the closest available drivers',
      explanation: 'The optimizer computes proximity between passenger pickup spots and driver departure points to fill cars efficiently and minimize driving detours.',
      runBtn: 'Calculate Optimal Allocation',
      applyBtn: 'Apply Recommendations',
      noSuggestions: 'Current allocation is already optimal or no passengers need a car.',
      suggestionsFound: 'suggestions found to optimize car seats:',
      assignPassenger: 'Assign passenger',
      toCar: 'to vehicle of',
      reasonProximity: 'Closest departure point / on route',
      reasonCapacity: 'Car with open capacity',
      appliedSuccess: 'Seat allocation applied successfully!'
    },
    pwa: {
      installTitle: 'Install Meet & Ride',
      installDesc: 'Add to your home screen for quick access to your rides, even offline.',
      installBtn: 'Install App',
      dismissBtn: 'Not now'
    }
  }
}

export function useI18n() {
  const localeCookie = useCookie<Locale>('meetride_locale', { default: () => 'it' })
  const locale = useState<Locale>('current_locale', () => localeCookie.value || 'it')

  function setLocale(newLocale: Locale) {
    locale.value = newLocale
    localeCookie.value = newLocale
    if (import.meta.client) {
      document.documentElement.setAttribute('lang', newLocale)
    }
  }

  function t(path: string): string {
    const parts = path.split('.')
    let current: any = translations[locale.value] || translations.it

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        // Fallback to Italian
        let fallback: any = translations.it
        for (const p of parts) {
          if (fallback && typeof fallback === 'object' && p in fallback) {
            fallback = fallback[p]
          } else {
            return path
          }
        }
        return typeof fallback === 'string' ? fallback : path
      }
    }

    return typeof current === 'string' ? current : path
  }

  return {
    locale,
    setLocale,
    t
  }
}
