import { useLanguage } from "@/contexts/LanguageContext";

interface ContactFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactForm({ isOpen, onClose }: ContactFormProps) {
  const { copy } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-end items-center mb-6">
          <button
            onClick={onClose}
            aria-label={copy.contact.close}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="font-semibold text-xl mb-2">{copy.contact.investors}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {copy.contact.investorDescription}{" "}
              <a
                href="https://stack.angellist.com/s/3cmz2r3k37"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-700"
              >
                https://stack.angellist.com/s/3cmz2r3k37
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl mb-2">{copy.contact.leaguePartners}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              {copy.contact.leagueDescription}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {copy.contact.email}{" "}
              <a
                href="mailto:contact@cornerstonedigitalsports.com"
                className="text-blue-600 underline hover:text-blue-700"
              >
                contact@cornerstonedigitalsports.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl mb-2">{copy.contact.collectors}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              {copy.contact.collectorDescription}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {copy.contact.inviteDescription}{" "}
              <a
                href="mailto:contact@cornerstonedigitalsports.com"
                className="text-blue-600 underline hover:text-blue-700"
              >
                contact@cornerstonedigitalsports.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
