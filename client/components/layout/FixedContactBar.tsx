import { useState } from "react";
import ContactForm from "@/components/ContactForm";

export default function FixedContactBar() {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 w-full border-t border-black/5 bg-white/80 dark:bg-black/80 dark:border-white/10 backdrop-blur-sm z-40 md:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-center">
          <button
            onClick={() => setIsContactFormOpen(true)}
            className="px-8 py-3 text-lg bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition"
            style={{ backgroundColor: "#004FFF" }}
          >
            Contact Us
          </button>
        </div>
      </div>
      <ContactForm isOpen={isContactFormOpen} onClose={() => setIsContactFormOpen(false)} />
    </>
  );
}
