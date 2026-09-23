import { useState } from "react";
import ContactForm from "@/components/ContactForm";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AppHeader() {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const { copy } = useLanguage();

  return (
    <>
      <header className="w-full border-b border-black/5 bg-white/80 dark:bg-black/80 dark:border-white/10">
        <div className="container mx-auto flex flex-wrap items-center gap-2 px-4 py-1.5 mt-6 mb-6 md:flex-nowrap">
          <div className="order-1 flex w-full min-w-0 items-center gap-2 md:order-none md:w-auto">
            <img
              src="/images/cds-logo-color-text.webp"
              alt="Cornerstone Digital Sports"
              className="h-[80px] w-[80px] flex-shrink-0 object-contain"
            />
            <h1 className="min-w-0 flex-1 text-[36px] leading-[36px] md:text-[50px] md:leading-[50px] lg:text-[60px] lg:leading-[60px]" style={{ fontFamily: "Roboto", fontWeight: 600 }}>
              Cornerstone Digital Sports
            </h1>
          </div>
          <LanguageSwitcher className="order-3 w-full justify-center md:order-none md:ml-auto md:w-auto md:justify-start" />
          <button
            onClick={() => setIsContactFormOpen(true)}
            className="hidden md:block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex-shrink-0 text-[28px] md:ml-4 overflow-hidden"
            style={{ backgroundColor: "#004FFF", boxShadow: "3px 3px 6px 0 rgba(155, 155, 155, 1)" }}
          >
            {copy.header.contactUs}
          </button>
        </div>
      </header>
      <ContactForm isOpen={isContactFormOpen} onClose={() => setIsContactFormOpen(false)} />
    </>
  );
}
