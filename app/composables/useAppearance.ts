export function useAppearance() {
  const colorMode = useColorMode()
  const accent = useState<'sky' | 'indigo' | 'emerald'>('app_accent', () => 'sky')

  const isDark = computed(() => colorMode.value === 'dark')

  useHead({
    htmlAttrs: {
      'data-accent': () => accent.value
    },
    meta: [
      {
        name: 'theme-color',
        content: () => (isDark.value ? '#0f172a' : '#0284c7')
      },
      {
        name: 'color-scheme',
        content: () => (isDark.value ? 'dark' : 'light')
      }
    ]
  })

  function toggleTheme() {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
  }

  function setAccent(newAccent: 'sky' | 'indigo' | 'emerald') {
    accent.value = newAccent
  }

  return {
    accent,
    isDark,
    toggleTheme,
    setAccent
  }
}
