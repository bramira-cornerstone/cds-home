import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { voteMediaForIndex } from "@/lib/sectionMedia";
import { fetchVoteLocations, fetchVoteByRank } from "@/lib/supabaseRest";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";

type VoteInfo = {
  playDescription: string | null;
  team: string | null;
  gameDate: string | null;
};

export default function VotePage() {
  const navigate = useNavigate();
  const betaAllowlist = useBetaAllowlist();
  const [voteLocations, setVoteLocations] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<VoteInfo | null>>(
    Array.from({ length: 20 }, () => null),
  );

  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    fetchVoteLocations(ctrl.signal)
      .then((vals) => {
        if (!active) return;
        setVoteLocations(vals || []);
      })
      .catch(() => {});
    return () => {
      active = false;
      try {
        ctrl.abort();
      } catch {}
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const ranks = Array.from({ length: 20 }, (_, i) => i + 1);
    Promise.allSettled(
      ranks.map(async (rank, idx) => {
        try {
          const row: any = await fetchVoteByRank(rank, ctrl.signal);
          if (!row) return [idx, null] as const;
          const playDescription =
            typeof row?.PlayDescription === "string" &&
            row.PlayDescription.trim()
              ? String(row.PlayDescription)
              : typeof row?.play_description === "string" &&
                  row.play_description.trim()
                ? String(row.play_description)
                : typeof row?.playDescription === "string" &&
                    row.playDescription.trim()
                  ? String(row.playDescription)
                  : null;
          const team =
            (row as any)?.team != null
              ? String((row as any).team)
              : (row as any)?.Team != null
                ? String((row as any).Team)
                : (row as any)?.TeamName != null
                  ? String((row as any).TeamName)
                  : null;
          const gameDate =
            typeof row?.GameDate === "string" && row.GameDate.trim()
              ? String(row.GameDate)
              : typeof (row as any)?.game_date === "string" &&
                  (row as any).game_date.trim()
                ? String((row as any).game_date)
                : typeof (row as any)?.gameDate === "string" &&
                    (row as any).gameDate.trim()
                  ? String((row as any).gameDate)
                  : null;
          const info: VoteInfo = { playDescription, team, gameDate };
          return [idx, info] as const;
        } catch (e: any) {
          if (e?.name === "AbortError") return [idx, null] as const;
          return [idx, null] as const;
        }
      }),
    ).then((settled) => {
      if (cancelled) return;
      const next = Array.from(
        { length: 20 },
        () => null,
      ) as Array<VoteInfo | null>;
      for (const r of settled) {
        if (r.status === "fulfilled" && r.value) {
          const [idx, info] = r.value;
          next[idx] = info;
        }
      }
      setRows(next);
    });
    return () => {
      cancelled = true;
      try {
        ctrl.abort();
      } catch {}
    };
  }, []);

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
    <>
      <img
        src="/images/voteBanner.gif"
        alt="Vote header"
        className="mx-auto rounded-md max-w-full h-auto"
      />
      <section className="container mx-auto px-4 py-6 nightmode_nocards max-lg:pt-6">
        <div className="mb-6 max-lg:mb-1.5 max-lg:mr-0 text-center uppercase text-[40px] font-normal leading-[40px] text-slate-800">
          VOTE
        </div>
        <p className="text-center text-slate-600 mb-3 max-w-2xl mx-auto text-xs leading-[14px]">
          One vote per user per round (weekly in live product, may take longer in testing phase).
          <br />
          <br />
          New supply is decided by vote demand: most popular as the most scarce, only the top 10 become relics at all.
        </p>
        <div className="space-y-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 items-stretch bg-white shadow-sm p-1 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => {
                try {
                  sessionStorage.setItem(
                    "vote_player_autoplay_unlocked",
                    "true",
                  );
                } catch {}
                const rank = i + 1;
                navigate(`/vote/Vote${String(rank).padStart(2, "0")}`);
              }}
            >
              <div className="relative flex-shrink-0 basis-[200px] md:basis-[300px] lg:basis-[400px] min-w-[200px] max-w-[400px] h-24 md:h-28 lg:h-32 rounded-md border border-slate-200 bg-slate-100 overflow-hidden sm:my-0 my-auto">
                {(() => {
                  const info = rows[i];
                  if (!info) return null; // empty placeholder when data missing
                  const id = voteLocations[i];
                  if (id) {
                    const src = `https://image.mux.com/${encodeURIComponent(id)}/thumbnail.png?time=5`;
                    return (
                      <img
                        className="absolute inset-0 w-full h-full object-cover"
                        src={src}
                        alt={`vote-${i + 1}`}
                      />
                    );
                  }
                  const p = voteMediaForIndex(i);
                  if (!p?.src) return null;
                  return p.mediaType === "video" ? (
                    <video
                      className="absolute inset-0 w-full h-full object-cover"
                      src={p.src}
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <img
                      className="absolute inset-0 w-full h-full object-cover"
                      src={p.src}
                      alt={`vote-${i + 1}`}
                    />
                  );
                })()}
              </div>
              <div className="flex-1 min-w-0 flex items-center">
                <table className="w-full text-xs md:text-sm text-slate-700">
                  <tbody>
                    <tr>
                      <td className="py-1">
                        {rows[i]?.playDescription?.trim()
                          ? rows[i]!.playDescription!
                          : `Highlight ${i + 1}`}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">
                        {rows[i] ? (rows[i]!.team ?? "") : "Coming soon"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">{rows[i]?.gameDate ?? ""}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
