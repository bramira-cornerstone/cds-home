import { useState } from "react";
import ContactForm from "@/components/ContactForm";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);

  return (
    <>
      <footer className="w-full border-t border-black/5 bg-white/80 dark:bg-black/80 dark:border-white/10 pb-[60px]">
        <div className="container mx-auto px-4 py-6 flex flex-col items-center justify-center gap-6">
          <button
            onClick={() => setIsContactFormOpen(true)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition"
            style={{ backgroundColor: "#004FFF" }}
          >
            Contact Us
          </button>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-slate-600 dark:text-slate-400 w-full">
            <div className="flex items-center gap-2">
              <img
                src="/images/cornerstone-logo.webp"
                alt="Cornerstone Digital Sports logo"
                className="h-6 w-6 rounded-md object-cover shadow-md"
              />
              <p>© {year} Cornerstone Digital Sports</p>
            </div>
            <div>
              <p>Where fandom has value</p>
            </div>
          </div>
        </div>
      </footer>
      <ContactForm isOpen={isContactFormOpen} onClose={() => setIsContactFormOpen(false)} />
    </>
  );
}
