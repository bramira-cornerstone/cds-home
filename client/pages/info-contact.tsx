import { useBetaAllowlist } from "@/hooks/useWalletProfile";

export default function InfoContactPage() {
  const betaAllowlist = useBetaAllowlist();
  if (betaAllowlist !== true) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="w-full rounded-none bg-white text-black p-6 text-center text-base">
          Platform is invitation only. Log in and enter your invite code to
          join.
        </div>
      </section>
    );
  }
  return (
    <section className="container mx-auto px-4 py-6 nightmode_nocards">
      <h1 className="mb-6 text-center uppercase font-sans text-[40px] leading-none text-slate-800 dark:text-white">
        CONTACT
      </h1>
      <div />
    </section>
  );
}
