import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'sf_theme_preference';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch (err) {
    console.warn('[ThemeContext] Erro ao ler preferência de tema do localStorage:', err);
  }
  return 'system';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const initial = getStoredTheme();
    if (initial === 'light') return 'light';
    if (initial === 'dark') return 'dark';
    return getSystemPrefersDark() ? 'dark' : 'light';
  });

  // Aplica a classe .dark na raiz do HTML e atualiza resolvedTheme
  const applyTheme = (targetTheme: ThemePreference) => {
    if (typeof document === 'undefined') return;

    let isDark = false;
    if (targetTheme === 'dark') {
      isDark = true;
    } else if (targetTheme === 'light') {
      isDark = false;
    } else {
      isDark = getSystemPrefersDark();
    }

    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    setResolvedTheme(isDark ? 'dark' : 'light');
  };

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch (err) {
      console.warn('[ThemeContext] Falha ao salvar tema no localStorage:', err);
    }
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme: ThemePreference = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  // Efeito para sincronizar na montagem e escutar mudanças do SO caso esteja em 'system'
  useEffect(() => {
    applyTheme(theme);

    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = () => {
      const currentStored = getStoredTheme();
      if (currentStored === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser utilizado dentro de um ThemeProvider');
  }
  return context;
};
