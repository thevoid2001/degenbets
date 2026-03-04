"use client";

import { createContext, useContext, ReactNode } from "react";

type Theme = "dark";

const ThemeContext = createContext<{
  theme: Theme;
}>({
  theme: "dark",
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}
