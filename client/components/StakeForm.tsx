import React, { useState, useEffect, useMemo } from "react";


import { getAlchemyThirdwebClient } from "@/lib/alchemyThirdwebClient";
import {
  fetchRelicSerialByEditionAndSerial,
  type RelicSerialRow,
} from "@/lib/supabaseRelicSerialsJoined";
import { fetchMintedByEditionId, type MintedRow } from "@/lib/supabaseMinted";

export type StakeFormProps = {
  editionId?: number | null;
  serial?: number | null;
  team?: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  showTitle?: boolean;
};

export default function StakeForm({
  editionId = null,
  serial = null,
  team = null,
  onSuccess,
  onCancel,
  showTitle = true,
}: StakeFormProps) {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();

  const [confirmationText, setConfirmationText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [editionData, setEditionData] = useState<
    (MintedRow & { SeriesName?: string; TierValue?: string }) | null
  >(null);
  const [serialData, setSerialData] = useState<RelicSerialRow | null>(null);
  const [teamName, setTeamName] = useState<string | null>(team ?? null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch edition data
  useEffect(() => {
    if (!editionId) {
      setEditionData(null);
      return;
    }

    const editionIdNum = parseInt(String(editionId), 10);
    if (!Number.isFinite(editionIdNum)) {
      setEditionData(null);
      return;
    }

    const loadEditionData = async () => {
      try {
        const data = await fetchMintedByEditionId(editionIdNum);
        setEditionData(data);
        // Get team name from edition data if team prop not provided
        if (!team && data && (data as any).TeamName) {
          setTeamName((data as any).TeamName);
        }
      } catch (err) {
        setEditionData(null);
      }
    };

    loadEditionData();
  }, [editionId, team]);

  // Fetch serial data and team info
  useEffect(() => {
    if (!editionId || !serial) {
      setIsLoading(false);
      return;
    }

    const loadSerialData = async () => {
      try {
        const data = await fetchRelicSerialByEditionAndSerial(
          editionId,
          serial,
          undefined,
        );
        setSerialData(data);

        // Fetch profile to get favorite team if not already set and team prop not provided
        if (!team && !teamName && account) {
          const baseUrl = import.meta.env.SUPABASE_URL as
            | string
            | undefined;
          const anonKey = import.meta.env.SUPABASE_ANON_KEY as
            | string
            | undefined;

          if (baseUrl && anonKey) {
            const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(
              account.address,
            )}&select=favorite_team&limit=1`;

            const res = await fetch(url, {
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                Accept: "application/json",
              },
            });

            if (res.ok) {
              const profiles = (await res.json()) as Array<{
                favorite_team: string | null;
              }>;
              if (profiles.length > 0 && profiles[0].favorite_team) {
                setTeamName(profiles[0].favorite_team);
              }
            }
          }
        }
      } catch (err) {
      } finally {
        setIsLoading(false);
      }
    };

    loadSerialData();
  }, [editionId, serial, account, team, teamName]);

  if (!account) {
    return (
      <div className="p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <p className="text-slate-600 dark:text-slate-400">
          Please connect your wallet to stake a relic.
        </p>
      </div>
    );
  }

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (confirmationText.toUpperCase() !== "SUBMIT") {
      setSubmitError('Please type "SUBMIT" to confirm staking.');
      return;
    }

    if (!editionId || !serial) {
      setSubmitError("Missing edition or serial information");
      return;
    }

    if (!serialData) {
      setSubmitError("Could not find relic serial");
      return;
    }

    try {
      setIsSubmitting(true);

      // Get the token_id from serialData
      const tokenId = (serialData as any).token_id ?? (serialData as any).tokenId;

      if (!tokenId) {
        throw new Error("Could not find relic serial");
      }

      const erc721Address = import.meta.env.VITE_ERC721_ADDRESS as
        | string
        | undefined;

      if (!erc721Address) {
        throw new Error("ERC721 contract address not configured");
      }

      // Create contract instance on Polygon
      const thirdwebClient = getAlchemyThirdwebClient();
      const contract = getContract({
        client: thirdwebClient,
        address: erc721Address,
        chain: polygon,
      });

      // Prepare the stake transaction
      const transaction = prepareContractCall({
        contract,
        method:
          "function stake(uint256 tokenId, bool longStake, string holderAuth)",
        params: [BigInt(tokenId), true, confirmationText],
      });

      // Send the transaction
      sendTransaction(transaction, {
        onSuccess: async () => {
          // Insert staking event record into the database
          const baseUrl = import.meta.env.SUPABASE_URL as
            | string
            | undefined;
          const anonKey = import.meta.env.SUPABASE_ANON_KEY as
            | string
            | undefined;

          if (baseUrl && anonKey && account?.address) {
            try {
              const insertUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/stakingEvents`;

              await fetch(insertUrl, {
                method: "POST",
                headers: {
                  apikey: anonKey,
                  Authorization: `Bearer ${anonKey}`,
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
                body: JSON.stringify({
                  token_id: tokenId,
                  staker: account.address,
                  longStake: true,
                  timestamp: new Date().toISOString(),
                }),
              });
            } catch (err) {
              console.error("Failed to record staking event:", err);
            }
          }

          setSubmitSuccess(true);

          // Call onSuccess callback instead of navigating
          setTimeout(() => {
            onSuccess?.();
          }, 2000);
        },
        onError: (error) => {
          setSubmitError(
            error instanceof Error
              ? error.message
              : "Failed to send transaction",
          );
        },
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to stake relic",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleStake}
      className="space-y-6 p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
      style={{ boxShadow: "2px 2px 3px 0 rgba(155, 155, 155, 1)" }}
    >
      {submitError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded">
          {submitError}
        </div>
      )}

      {submitSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 p-4 rounded">
          Relic staked successfully!
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded p-4">
          <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
            Staking this relic will help you climb the{" "}
            <span className="font-semibold">{teamName || "team"}</span>{" "}
            rankings. You will be unable to sell, transfer, or burn it for 365
            days until it unlocks. Are you sure? If so type "SUBMIT" in the box
            and hit the "Stake" button below.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-white">
            Confirmation
          </label>
          <input
            type="text"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder='Type "SUBMIT" to confirm'
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white"
          />
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            submitSuccess ||
            confirmationText.toUpperCase() !== "SUBMIT"
          }
          className="flex-1 bg-[#004FFF] hover:bg-[#0040CC] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded transition"
        >
          <p>
            {submitSuccess
              ? "Success!"
              : isSubmitting
                ? "Staking..."
                : "Stake"}
          </p>
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitSuccess}
          className="flex-1 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-700 dark:text-white font-medium py-2 px-4 rounded transition sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
