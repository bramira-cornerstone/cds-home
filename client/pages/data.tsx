import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import { WalletDailyValueChart } from "@/components/WalletDailyValueChart";
import { WalletProfitLossChart } from "@/components/WalletProfitLossChart";
import GlobalEventsChart from "@/components/GlobalEventsChart";

export default function DataPage() {
  return (
    <section className="container mx-auto px-4 py-6 nightmode_cards sm:pt-3">
      <div className="w-full mb-4">
        <img
          src="https://cdn.builder.io/api/v1/file/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2Ff79af1158ae64ffca6ef450b72db3b3e"
          alt="Data banner"
          className="w-full h-auto object-cover rounded-md"
        />
      </div>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-col gap-6">
        <WalletDailyValueChart />
        <WalletProfitLossChart />
        <GlobalEventsChart />
      </div>
    </section>
  );
}
