import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const THEMES = ['light', 'dark', 'catppuccin-light', 'catppuccin-dark']

const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme)
        set({ theme })
      },
    }),
    {
      name: 'bibliotrack-theme',
      onRehydrateStorage: () => (state) => {
        if (state) document.documentElement.setAttribute('data-theme', state.theme)
      },
    }
  )
)

export default useThemeStore
