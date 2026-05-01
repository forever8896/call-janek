import React, { createContext, useContext, useState } from 'react';

export type Lang = 'EN' | 'CZ';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
};

const LangContext = createContext<Ctx>({
  lang: 'EN',
  setLang: () => {},
  toggle: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('EN');
  const toggle = () => setLang((l) => (l === 'EN' ? 'CZ' : 'EN'));
  return (
    <LangContext.Provider value={{ lang, setLang, toggle }}>{children}</LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

export function useT() {
  const { lang } = useLang();
  return (en: string, cz: string) => (lang === 'CZ' ? cz : en);
}
