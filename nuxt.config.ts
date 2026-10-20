// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: {
    enabled: true
  },

  runtimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY || ''
  },

  css: ['~/assets/css/main.css'],

  telemetry: false,

  app: {
    head: {
      htmlAttrs: {
        lang: 'it'
      },
      title: 'Meet & Ride — Carpooling per Eventi',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0284c7' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Meet & Ride' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'format-detection', content: 'telephone=no' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' }
      ]
    }
  },

  colorMode: {
    preference: 'system',
    fallback: 'dark',
    classSuffix: ''
  },

  modules: ['@nuxtjs/supabase', '@nuxt/ui', '@vite-pwa/nuxt'],

  supabase: {
    redirect: false
  },

  nitro: {
    storage: {
      meetride: {
        driver: 'fs',
        base: './.data/db'
      }
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    registerWebManifestInRouteRules: true,
    devOptions: {
      enabled: false,
      suppressWarnings: true
    },
    client: {
      installPrompt: 'meet-ride:install-dismissed'
    },
    manifest: {
      id: '/',
      name: 'Meet & Ride — Carpooling & Posti Auto per Eventi',
      short_name: 'MeetRide',
      description: 'Organizza i passaggi in auto per i tuoi eventi e ottimizza i posti disponibili in base alla posizione.',
      lang: 'it',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'any',
      background_color: '#0f172a',
      theme_color: '#0284c7',
      categories: ['travel', 'utilities', 'social'],
      prefer_related_applications: false,
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api/],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pages',
            networkTimeoutSeconds: 5,
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 60 * 60 * 24
            }
          }
        },
        {
          urlPattern: ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'assets',
            expiration: {
              maxEntries: 80,
              maxAgeSeconds: 60 * 60 * 24 * 30
            }
          }
        },
        {
          urlPattern: ({ request }) => request.destination === 'image',
          handler: 'CacheFirst',
          options: {
            cacheName: 'images',
            expiration: {
              maxEntries: 60,
              maxAgeSeconds: 60 * 60 * 24 * 30
            }
          }
        }
      ]
    },
    includeAssets: ['favicon.ico', 'favicon.svg', 'robots.txt', 'icons/*.png']
  }
})
