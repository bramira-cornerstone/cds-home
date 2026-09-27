import { useState } from "react";
import ContactForm from "@/components/ContactForm";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FixedContactBar() {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const { copy } = useLanguage();

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 w-full border-t border-black/5 bg-white/95 dark:bg-black/85 dark:border-white/10 backdrop-blur-sm z-40 md:hidden">
        <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-3 sm:gap-3">
          <span className="min-w-0 whitespace-pre-line text-center text-lg leading-tight">{copy.header.buildPrompt}</span>
          <button
            onClick={() => setIsContactFormOpen(true)}
            className="shrink-0 px-8 py-3 text-lg bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition"
            style={{ backgroundColor: "#004FFF" }}
          >
            {copy.header.contactUs}
          </button>
        </div>
      </div>
      <ContactForm isOpen={isContactFormOpen} onClose={() => setIsContactFormOpen(false)} />
    </>
  );
}
