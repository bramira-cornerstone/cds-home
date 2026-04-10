import { useEditionMetadata } from "@/hooks/useEditionMetadata";
import EditionCardMini from "@/components/EditionCardMini";

interface EditionCardMiniWithDataProps {
  editionId: number;
}

export function EditionCardMiniWithData({
  editionId,
}: EditionCardMiniWithDataProps) {
  const { metadata } = useEditionMetadata(editionId);

  if (!metadata) {
    return (
      <div className="h-full w-full p-[2px]">
        <div className="relative h-full w-full rounded-[1px] border border-slate-200 bg-white p-1">
          <div className="text-center text-[10px] text-slate-400">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <EditionCardMini
      id={metadata.edition_id}
      name={metadata.name}
      thumb={metadata.thumb}
      tier={metadata.tier}
      minted={metadata.minted}
      gameDate={metadata.gameDate}
      createDate={metadata.createDate}
      setName={metadata.setName}
      badge={metadata.badge}
      badge2={metadata.badge2}
      badge3={metadata.badge3}
      team={metadata.team}
    />
  );
}
