import { Link } from "react-router-dom";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";

export default function FriendsPage() {
  const betaAllowlist = useBetaAllowlist();
  // Temporarily deactivated betaAllowlist check
  // if (betaAllowlist !== true) {
  //   return (
  //     <section className="container mx-auto px-4 py-16">
  //       <div className="w-full rounded-none bg-white text-black p-6 text-center text-base">
  //         Platform is invitation only. Log in and enter your invite code to
  //         join.
  //       </div>
  //     </section>
  //   );
  // }
  return (
    <section className="container mx-auto px-4 py-8 space-y-6 nightmode_cards">
      <h1 className="text-center md:text-left text-lg md:text-xl font-semibold tracking-wide text-slate-800 dark:text-white">
        Friends
      </h1>
    </section>
  );
}
