interface ContactFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactForm({ isOpen, onClose }: ContactFormProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-end items-center mb-6">
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="font-semibold text-xl mb-2">Investors</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Equity offering announcing soon. Join the waitlist to be notified:{" "}
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
            <h2 className="font-semibold text-xl mb-2">League Partners</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Interested in discussing how we could bring this to your league?
            </p>
            <p>
              Email{" "}
              <a
                href="mailto:contact@cornerstonedigitalsports.com"
                className="text-blue-600 underline hover:text-blue-700"
              >
                contact@cornerstonedigitalsports.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl mb-2">Collectors</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Working demo released to closed beta. Email for demo
            </p>
            <p>
              Email for invite code to try it:{" "}
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
