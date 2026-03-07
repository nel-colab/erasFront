import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    dark: false,
  }),
  actions: {
    init() {
      const saved = localStorage.getItem('theme') || 'light'
      this.dark = saved === 'dark'
      document.documentElement.setAttribute('data-theme', saved)
    },
    toggle() {
      this.dark = !this.dark
      const theme = this.dark ? 'dark' : 'light'
      localStorage.setItem('theme', theme)
      document.documentElement.setAttribute('data-theme', theme)
    },
  },
})
