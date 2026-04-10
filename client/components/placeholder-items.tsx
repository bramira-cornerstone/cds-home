import React from "react";
import { getPlaceholder } from "@/lib/placeholders";

type Media = { src: string; mediaType: "image" | "video" } | undefined;

function PlaceholderMedia({ media, alt }: { media: Media; alt: string }) {
  if (!media?.src) return null;
  if (media.mediaType === "video") {
    return (
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={media.src}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }
  return (
    <img className="absolute inset-0 w-full h-full object-cover" src={media.src} alt={alt} />
  );
}

function BasePlaceholderCard({
  placeholderKey,
  alt,
}: {
  placeholderKey:
    | "voteDefault"
    | "redeemDefault"
    | "dropsEpic"
    | "dropsRare"
    | "dropsBasic"
    | "earnDefault"
    | "dataPlayerDefault";
  alt: string;
}) {
  const media = getPlaceholder(placeholderKey);
  return (
    <div className="relative w-full max-w-sm mx-auto h-64 rounded-md border border-slate-200 bg-slate-100 shadow-inner overflow-hidden">
      <PlaceholderMedia media={media} alt={alt} />
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight text-sm md:text-base text-slate-700 pointer-events-none">
        <div>Coming</div>
        <div>Soon</div>
      </div>
    </div>
  );
}

// VOTE components (01..20)
export const Vote01 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote01" />;
export const Vote02 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote02" />;
export const Vote03 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote03" />;
export const Vote04 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote04" />;
export const Vote05 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote05" />;
export const Vote06 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote06" />;
export const Vote07 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote07" />;
export const Vote08 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote08" />;
export const Vote09 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote09" />;
export const Vote10 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote10" />;
export const Vote11 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote11" />;
export const Vote12 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote12" />;
export const Vote13 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote13" />;
export const Vote14 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote14" />;
export const Vote15 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote15" />;
export const Vote16 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote16" />;
export const Vote17 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote17" />;
export const Vote18 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote18" />;
export const Vote19 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote19" />;
export const Vote20 = () => <BasePlaceholderCard placeholderKey="voteDefault" alt="Vote20" />;

// REDEEM components (01..10)
export const Redeem01 = () => <BasePlaceholderCard placeholderKey="redeemDefault" alt="Redeem01" />;
export const Redeem02 = () => <BasePlaceholderCard placeholderKey="redeemDefault" alt="Redeem02" />;
export const Redeem03 = () => <BasePlaceholderCard placeholderKey="redeemDefault" alt="Redeem03" />;
export const Redeem04 = () => <BasePlaceholderCard placeholderKey="redeemDefault" alt="Redeem04" />;
export const Redeem05 = () => <BasePlaceholderCard placeholderKey="redeemDefault" alt="Redeem05" />;
export const Redeem06 = () => <BasePlaceholderCard placeholderKey="redeemDefault" alt="Redeem06" />;
export const Redeem07 = () => <BasePlaceholderCard placeholderKey="redeemDefault" alt="Redeem07" />;
export const Redeem08 = () => <BasePlaceholderCard placeholderKey="redeemDefault" alt="Redeem08" />;
export const Redeem09 = () => <BasePlaceholderCard placeholderKey="redeemDefault" alt="Redeem09" />;
export const Redeem10 = () => <BasePlaceholderCard placeholderKey="redeemDefault" alt="Redeem10" />;

// DROPS components (01..03) -> Epic, Rare, Basic
export const Drops01 = () => <BasePlaceholderCard placeholderKey="dropsEpic" alt="Drops01" />;
export const Drops02 = () => <BasePlaceholderCard placeholderKey="dropsRare" alt="Drops02" />;
export const Drops03 = () => <BasePlaceholderCard placeholderKey="dropsBasic" alt="Drops03" />;

// EARN components (01..04)
export const Earn01 = () => <BasePlaceholderCard placeholderKey="earnDefault" alt="Earn01" />;
export const Earn02 = () => <BasePlaceholderCard placeholderKey="earnDefault" alt="Earn02" />;
export const Earn03 = () => <BasePlaceholderCard placeholderKey="earnDefault" alt="Earn03" />;
export const Earn04 = () => <BasePlaceholderCard placeholderKey="earnDefault" alt="Earn04" />;


export const PlaceholderComponentMap: Record<string, React.ComponentType<any>> = {
  Vote01,
  Vote02,
  Vote03,
  Vote04,
  Vote05,
  Vote06,
  Vote07,
  Vote08,
  Vote09,
  Vote10,
  Vote11,
  Vote12,
  Vote13,
  Vote14,
  Vote15,
  Vote16,
  Vote17,
  Vote18,
  Vote19,
  Vote20,
  Redeem01,
  Redeem02,
  Redeem03,
  Redeem04,
  Redeem05,
  Redeem06,
  Redeem07,
  Redeem08,
  Redeem09,
  Redeem10,
  Drops01,
  Drops02,
  Drops03,
  Earn01,
  Earn02,
  Earn03,
  Earn04,
};
