import { createContext, useContext, useState } from "react";

export const LanguageContext = createContext({ lang: "en", toggleLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("app_lang") || "en");

  const toggleLang = () => {
    const next = lang === "en" ? "es" : "en";
    setLang(next);
    localStorage.setItem("app_lang", next);
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
