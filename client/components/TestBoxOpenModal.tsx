import React, { useState } from "react";
import { fetchRelicSerialByTokenId } from "@/lib/supabaseRelicSerialsJoined";

export type TestBoxOpenModalProps = {
  boxTokenId?: bigint | number | null;
  userAddress?: string;
  onBoxOpenComplete?: (result: {
    success: boolean;
    message: string;
    awardedTokenIds?: number[];
    relicData?: Array<{ edition_id: number; serial: number; token_id: number }>;
  }) => void;
  onClose?: () => void;
};

// Mock RelicBatchMinted event structure:
// event RelicBatchMinted(address indexed to, uint256[] tokenIds)
//
// Example JSON:
// {
//   "to": "0x742d35Cc6634C0532925a3b844Bc0e7595f0bEb",
//   "tokenIds": [338, 162]
// }

export default function TestBoxOpenModal({
  boxTokenId,
  userAddress,
  onBoxOpenComplete,
  onClose,
}: TestBoxOpenModalProps) {
  const [eventJson, setEventJson] = useState(
    JSON.stringify(
      {
        to: userAddress || "0x742d35Cc6634C0532925a3b844Bc0e7595f0bEb",
        tokenIds: [338, 162],
      },
      null,
      2,
    ),
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function handleProcessEvent() {
    if (!eventJson.trim()) {
      setStatus("❌ Event JSON is empty");
      return;
    }

    setLoading(true);
    setStatus("Processing event...");

    try {
      // Parse the JSON
      const event = JSON.parse(eventJson);

      if (!Array.isArray(event.tokenIds)) {
        throw new Error("tokenIds must be an array");
      }

      const awardedTokenIds = event.tokenIds.map((id: any) =>
        typeof id === "string" ? parseInt(id, 10) : id,
      );

      setStatus("Fetching relic data...");

      // Fetch full relic data for each token from RelicSerialsJoined
      const relicData = await Promise.all(
        awardedTokenIds.map(async (rId) => {
          const row = await fetchRelicSerialByTokenId(rId);

          if (!row) {
            return {
              edition_id: 0,
              serial: 0,
              token_id: rId,
            };
          }

          return {
            edition_id: row.edition_id ?? 0,
            serial: row.serial ?? 0,
            token_id: rId,
            ...row, // Include all other fields from RelicSerialsJoined
          };
        }),
      );

      setStatus("✅ Event processed successfully!");

      onBoxOpenComplete?.({
        success: true,
        message: "Test box opened successfully!",
        awardedTokenIds,
        relicData,
      });
    } catch (err: any) {
      const msg = err?.message || "Failed to process event";
      setStatus(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          RelicBatchMinted Event JSON
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Paste or modify the RelicBatchMinted event data. You can change the tokenIds values.
        </p>
        <textarea
          value={eventJson}
          onChange={(e) => setEventJson(e.target.value)}
          placeholder={JSON.stringify(
            {
              to: "0x742d35Cc6634C0532925a3b844Bc0e7595f0bEb",
              tokenIds: [338, 162],
            },
            null,
            2,
          )}
          className="w-full h-40 p-3 border border-slate-300 rounded font-mono text-sm bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
        />
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <strong>Box Token ID:</strong> {boxTokenId ?? "N/A"}
        </p>
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <strong>User Address:</strong> {userAddress ?? "N/A"}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          disabled={loading}
          onClick={handleProcessEvent}
          className="flex-1 px-3 py-2 bg-[#4169E1] text-white rounded disabled:opacity-50 font-medium"
        >
          {loading ? "Processing..." : "Process Event & Open Carousel"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 bg-slate-200 text-slate-900 rounded hover:bg-slate-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
        >
          Close
        </button>
      </div>

      {status && (
        <p className="text-sm mt-2 whitespace-pre-line p-3 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
          {status}
        </p>
      )}
    </div>
  );
}
