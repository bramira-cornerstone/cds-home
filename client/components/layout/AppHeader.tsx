import { useState } from "react";
import ContactForm from "@/components/ContactForm";

export default function AppHeader() {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);

  return (
    <>
      <header className="w-full border-b border-black/5 bg-white/80 dark:bg-black/80 dark:border-white/10">
        <div className="container mx-auto px-4 py-2 flex items-center gap-4 mt-6 mb-6">
          <img
            src="/images/cds-logo-color-text.webp"
            alt="Cornerstone Digital Sports"
            className="h-20 w-20 object-contain flex-shrink-0"
          />
          <h1 className="text-[40px] md:text-[50px] lg:text-[60px] leading-[40px] md:leading-[50px] lg:leading-[60px]" style={{ fontFamily: "Roboto", fontWeight: 600 }}>
            Cornerstone Digital Sports
          </h1>
          <button
            onClick={() => setIsContactFormOpen(true)}
            className="hidden md:block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex-shrink-0 text-[28px] ml-auto overflow-hidden"
            style={{ backgroundColor: "#004FFF", boxShadow: "3px 3px 6px 0 rgba(155, 155, 155, 1)" }}
          >
            Contact Us
          </button>
        </div>
      </header>
      <ContactForm isOpen={isContactFormOpen} onClose={() => setIsContactFormOpen(false)} />
    </>
  );
}
