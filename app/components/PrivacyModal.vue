<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const { locale } = useI18n()
</script>

<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
    :title="locale === 'it' ? 'Privacy & Protezione Dati (GDPR)' : 'Privacy & Data Protection (GDPR)'"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div v-if="locale === 'it'" class="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        <div class="rounded-xl bg-sky-50/70 p-3.5 border border-sky-100 dark:bg-sky-950/30 dark:border-sky-900/40">
          <p class="font-bold text-sky-900 dark:text-sky-200 text-sm flex items-center gap-1.5">
            <UIcon name="i-lucide-shield-check" class="h-4 w-4 text-sky-600" />
            Principio di Minimizzazione dei Dati (Art. 5 GDPR)
          </p>
          <p class="mt-1 text-[11px] text-sky-800 dark:text-sky-300">
            Meet & Ride raccoglie esclusivamente le informazioni strettamente indispensabili per coordinare i posti in auto. Non tracciamo la tua posizione in tempo reale, non usiamo tracker pubblicitari e non vendiamo i tuoi dati.
          </p>
        </div>

        <div>
          <h4 class="font-bold text-slate-900 dark:text-white mb-1">1. Quali dati raccogliamo e perché</h4>
          <ul class="list-disc pl-5 space-y-1">
            <li><strong>Organizzatori:</strong> Nome, email e password protetta (hash) per consentirti di gestire i tuoi eventi.</li>
            <li><strong>Partecipanti (Guidatori & Passeggeri):</strong> Nome o nickname, zona indicativa di partenza/ritrovo e capienza auto. Il recapito telefonico è facoltativo e serve unicamente ai compagni di viaggio per coordinarsi.</li>
          </ul>
        </div>

        <div>
          <h4 class="font-bold text-slate-900 dark:text-white mb-1">2. Trattamento con Intelligenza Artificiale (Gemini AI)</h4>
          <p>
            Quando viene eseguita l'ottimizzazione dei posti, i dati inviati al modello AI sono <strong>pseudonimizzati</strong>:
            non vengono mai trasmessi numeri di telefono, email o dati personali sensibili. Vengono inviati solo i punti di ritrovo generici e il numero di posti necessari per il calcolo del percorso ottimale.
          </p>
        </div>

        <div>
          <h4 class="font-bold text-slate-900 dark:text-white mb-1">3. Cookie & Tracciamento</h4>
          <p>
            Utilizziamo esclusivamente <strong>cookie tecnici/funzionali</strong> necessari all'autenticazione dell'organizzatore, allo sblocco dell'evento tramite password e alla memorizzazione della lingua preferita. <strong>Zero cookie di profilazione o terze parti</strong>.
          </p>
        </div>

        <div>
          <h4 class="font-bold text-slate-900 dark:text-white mb-1">4. Diritto all'Oblio e Cancellazione (Art. 17 GDPR)</h4>
          <p>
            Puoi cancellare la tua partecipazione all'evento in qualsiasi momento con un solo clic tramite il pulsante <em>"Rimuovi la mia presenza"</em>. Quando l'organizzatore elimina un evento, tutti i relativi passaggi vengono cancellati definitivamente.
          </p>
        </div>
      </div>

      <div v-else class="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        <div class="rounded-xl bg-sky-50/70 p-3.5 border border-sky-100 dark:bg-sky-950/30 dark:border-sky-900/40">
          <p class="font-bold text-sky-900 dark:text-sky-200 text-sm flex items-center gap-1.5">
            <UIcon name="i-lucide-shield-check" class="h-4 w-4 text-sky-600" />
            Data Minimization Principle (Art. 5 GDPR)
          </p>
          <p class="mt-1 text-[11px] text-sky-800 dark:text-sky-300">
            Meet & Ride only collects data strictly necessary to coordinate car seats. We do not track your live location, use advertising trackers, or sell your data.
          </p>
        </div>

        <div>
          <h4 class="font-bold text-slate-900 dark:text-white mb-1">1. What data we collect and why</h4>
          <ul class="list-disc pl-5 space-y-1">
            <li><strong>Organizers:</strong> Name, email, and secure hashed password to manage your events.</li>
            <li><strong>Participants (Drivers & Passengers):</strong> Name/alias, pickup/departure area, and available seats. Phone number is optional and used solely by travel companions for coordination.</li>
          </ul>
        </div>

        <div>
          <h4 class="font-bold text-slate-900 dark:text-white mb-1">2. AI Processing (Gemini AI)</h4>
          <p>
            When seat optimization is calculated, the data sent to the AI model is <strong>pseudonymized</strong>:
            phone numbers, emails, and sensitive details are never sent. Only generic pickup spots and seat counts are processed.
          </p>
        </div>

        <div>
          <h4 class="font-bold text-slate-900 dark:text-white mb-1">3. Cookies & Tracking</h4>
          <p>
            We strictly use <strong>essential functional cookies</strong> for login session, event password unlock, and language preferences. <strong>No tracking or advertising cookies</strong>.
          </p>
        </div>

        <div>
          <h4 class="font-bold text-slate-900 dark:text-white mb-1">4. Right to Erasure (Art. 17 GDPR)</h4>
          <p>
            You can delete your registration at any time with one click via <em>"Leave this event"</em>. When an organizer deletes an event, all associated data is permanently erased.
          </p>
        </div>
      </div>

      <div class="mt-5 flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
        <UButton
          color="neutral"
          variant="solid"
          size="sm"
          @click="emit('update:open', false)"
        >
          {{ locale === 'it' ? 'Ho capito' : 'Close' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
