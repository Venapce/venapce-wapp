import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { readValue, writeValue } from '@/lib/localStore'

// Theme handling, adopted from FloMorphic: a light/dark/system preference driven
// by a `.dark` class on <html>, persisted, and reactive to OS changes on "system".
export type ThemePreference = 'light' | 'dark' | 'system'

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function applyTheme(pref: ThemePreference): void {
  const dark = pref === 'dark' || (pref === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

function isDarkFor(pref: ThemePreference): boolean {
  return pref === 'dark' || (pref === 'system' && systemPrefersDark())
}

export const useUiStore = defineStore('ui', () => {
  const theme = ref<ThemePreference>(readValue<ThemePreference>('theme', 'system'))
  /** The resolved theme. Charts read this: ECharts paints its own axes and
   *  labels, so it can't inherit the CSS variables the rest of the UI uses. */
  const isDark = ref(isDarkFor(theme.value))

  applyTheme(theme.value)

  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.value === 'system') {
      applyTheme('system')
      isDark.value = isDarkFor('system')
    }
  })

  watch(theme, (value) => {
    applyTheme(value)
    isDark.value = isDarkFor(value)
    writeValue('theme', value)
  })

  function setTheme(value: ThemePreference): void {
    theme.value = value
  }

  function cycleTheme(): void {
    const order: ThemePreference[] = ['light', 'dark', 'system']
    theme.value = order[(order.indexOf(theme.value) + 1) % order.length]
  }

  return { theme, isDark, setTheme, cycleTheme }
})
