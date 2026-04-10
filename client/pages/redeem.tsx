import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import { useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
import useRedeemCards from "@/components/redeem-cards";
import EditionHoverPreview from "@/components/EditionHoverPreview";
import { RedeemCardCountdown } from "@/components/RedeemCardCountdown";
import { getTeamCrest } from "@/lib/teams";

export default function RedeemPage() {
  const betaAllowlist = useBetaAllowlist();
  const navigate = useNavigate();
  const { cards, loading } = useRedeemCards();
  const [comingSoonCards, setComingSoonCards] = useState<Set<number>>(
    new Set(),
  );

  const handleComingSoonChange = useCallback(
    (cardId: number, isComingSoon: boolean) => {
      setComingSoonCards((prev) => {
        const updated = new Set(prev);
        if (isComingSoon) {
          updated.add(cardId);
        } else {
          updated.delete(cardId);
        }
        return updated;
      });
    },
    [],
  );

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
    <section className="container mx-auto px-4 py-6 nightmode_nocards">
      <div className="w-full mb-4">
        <img
          src="https://cdn.builder.io/api/v1/file/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F175b6f0c9089448fa420532cee454aff"
          alt="Redeem banner"
          className="w-full h-auto object-cover rounded-md"
        />
      </div>
      <h1 className="mb-6 text-center uppercase font-sans text-[40px] leading-none text-slate-800">
        REDEEM
      </h1>
      <ul className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {cards.map((card) => (
          <li
            key={card.id}
            className="flex gap-4 max-sm:gap-2 shadow-[1px_1px_3px_0px_rgba(0,0,0,1)] cursor-pointer max-sm:bg-white"
            onClick={() => navigate(`/redeem/Redeem${card.id}`)}
          >
            <div className="relative block rounded-md border border-slate-300 bg-white p-3 hover:shadow-sm focus:outline-none shadow-[0_5px_0_0_rgba(226,232,240,1)] holo-card flex-shrink-0 max-sm:w-[200px] max-sm:m-[8px_0_8px_8px] m-[8px_0_8px_8px]">
              {card.name ? (
                <h3 className="text-center text-base md:text-lg font-semibold text-slate-800 mb-1">
                  {card.name}
                </h3>
              ) : null}
              {card.thumb ? (
                <div className="mb-2 overflow-hidden rounded-md bg-slate-100 aspect-video">
                  <EditionHoverPreview
                    thumb={card.thumb}
                    streamId={card.videoId ?? null}
                  />
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <div className="text-xs md:text-sm text-slate-700">
                  {card.tier && card.minted != null ? (
                    <>
                      <p>{String(card.minted)} to ever exist</p>
                      <p>
                        <span style={{ fontSize: "14px" }}>{card.tier}</span>
                      </p>
                    </>
                  ) : (
                    `edition_id: ${card.id}`
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="inline-block h-[25px] w-[25px]"
                    aria-hidden="true"
                  >
                    {card.badge3 ? (
                      <img
                        src={card.badge3}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                  </span>
                  <span
                    className="inline-block h-[25px] w-[25px]"
                    aria-hidden="true"
                  >
                    {card.badge2 ? (
                      <img
                        src={card.badge2}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                  </span>
                  <span
                    className="inline-block h-[25px] w-[25px]"
                    aria-hidden="true"
                  >
                    {card.badge ? (
                      <img
                        src={card.badge}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                  </span>
                </div>
              </div>
              <div className="relative">
                {card.gameDate ? (
                  <div className="text-[11px] md:text-xs text-slate-600">
                    Game Date: {card.gameDate}
                  </div>
                ) : null}
                <div className="text-[11px] md:text-xs text-slate-600">
                  Mint Date:{" "}
                  {card.createDate ? String(card.createDate).slice(0, 10) : "—"}
                </div>
              </div>
              {card.setName ? (
                <div className="flex flex-col items-center">
                  <div className="text-[12px] md:text-sm text-slate-700 text-center mx-auto">
                    {card.setName}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex-1 flex flex-col justify-start max-sm:m-[8px_8px_8px_0] mt-0">
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="mt-12">
                  <span className="break-words">
                    {card.minted
                      ? Math.round((card.minted as number) * 0.2)
                      : 0}{" "}
                    AVAILABLE
                  </span>
                </li>
                <li>
                  <span className="break-words">
                    Earn by redeeming prior {card.team || "relic"} relics
                  </span>
                </li>
                {!comingSoonCards.has(card.id) && (
                  <li>
                    <span className="break-words">Ending:</span>
                    <div
                      style={{
                        color: "rgba(255, 99, 0, 1)",
                        filter: "drop-shadow(1px 1px 20px rgba(0, 0, 0, 1))",
                        fontSize: "16px",
                        fontWeight: "700",
                      }}
                    >
                      <RedeemCardCountdown
                        editionId={card.id}
                        cardId={card.id}
                        onComingSoon={handleComingSoonChange}
                      />
                    </div>
                  </li>
                )}
                {comingSoonCards.has(card.id) && (
                  <li>
                    <div
                      style={{
                        color: "rgba(255, 99, 0, 1)",
                        filter: "drop-shadow(1px 1px 20px rgba(0, 0, 0, 1))",
                        fontSize: "16px",
                        fontWeight: "700",
                      }}
                    >
                      Coming Soon
                    </div>
                  </li>
                )}
              </ul>
              {card.team ? (
                <div className="mt-2 max-sm:flex max-sm:flex-col max-sm:justify-end max-sm:items-center max-sm:mx-auto">
                  {getTeamCrest(card.team) ? (
                    <img
                      src={getTeamCrest(card.team)}
                      alt={`${card.team} crest`}
                      className="h-[50px] w-[50px]"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!loading && cards.length === 0 && (
        <div className="text-center py-8 text-slate-600">
          No items available to redeem
        </div>
      )}
    </section>
  );
}
