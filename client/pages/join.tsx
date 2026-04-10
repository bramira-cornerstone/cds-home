import { useState, useRef, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { INVITE_CODE_VALIDATION_ENABLED } from "@/lib/config";
import { updateAnalyticsStatus } from "@/utils/analytics";

function normalizeUsernameRaw(s: string): string {
  const lower = (s || "").toLowerCase();
  const deaccent = lower
    .normalize("NFD")
    // remove diacritics
    .replace(/\p{Diacritic}+/gu, "");
  const leet = deaccent
    .replace(/[@ªàáâãäåæ4]/g, "a")
    .replace(/[ß$5]/g, "s")
    .replace(/[3€ℯ]/g, "e")
    .replace(/[1!|il]/g, "i")
    .replace(/[0°ºøöóòôõ]/g, "o")
    .replace(/[7†]/g, "t")
    .replace(/[8]/g, "b")
    .replace(/[9]/g, "g")
    .replace(/[_\-\.\s]/g, "");
  // collapse repeated chars (e.g., fuuuck -> fuuck)
  const collapsed = leet.replace(/(.)\1{2,}/g, "$1$1");
  return collapsed;
}

function getBannedFromEnv(): string[] {
  const raw = (import.meta as any).env.BANNED_USERNAMES as string | undefined;
  if (!raw) return [];
  try {
    const arr = JSON.parse(`[${raw}]`);
    if (Array.isArray(arr)) {
      return arr.map((s: any) => String(s).toLowerCase()).filter(Boolean);
    }
  } catch {}
  return raw
    .split(",")
    .map((s) =>
      s
        .trim()
        .replace(/^\"|\"$/g, "")
        .toLowerCase(),
    )
    .filter(Boolean);
}

function looksOffensive(username: string): boolean {
  const src = username || "";
  const norm = normalizeUsernameRaw(src);
  const noVowels = norm.replace(/[aeiou]/g, "");
  const banned = getBannedFromEnv();

  const haystacks = [src.toLowerCase(), norm, noVowels];
  for (const needle of banned) {
    if (needle.length < 3) continue;
    for (const h of haystacks) {
      if (h.includes(needle)) return true;
    }
  }

  const patterns: RegExp[] = [
    /f+\W*\s*u+\W*\s*c+\W*\s*k+/i,
    /s+\W*\s*h+\W*\s*i+\W*\s*t+/i,
    /n+\W*\s*a+\W*\s*z+\W*\s*i+/i,
  ];
  return patterns.some((re) => re.test(src));
}

export default function ProfilePage() {
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteCodeError, setInviteCodeError] = useState<string>("");
  const [agree, setAgree] = useState(false);
  const account = useActiveAccount();
  const displayValue = account?.address
    ? `${account.address.slice(0, 6)}…${account.address.slice(-4)}`
    : "Not set";
  const [tosScrolledEnd, setTosScrolledEnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [analyticsOptout, setAnalyticsOptout] = useState(false);
  const tosRef = useRef<HTMLDivElement>(null);

  const validateInviteCode = async (code: string) => {
    setInviteCodeError("");

    // If code is blank, that's okay (invite code is optional)
    if (!code.trim()) {
      return true;
    }

    try {
      const baseUrl = (import.meta as any).env.SUPABASE_URL as
        | string
        | undefined;
      const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
        | string
        | undefined;

      if (!baseUrl || !anonKey) {
        return true; // Can't validate, let backend handle it
      }

      const headers = {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      };

      // Check if code exists in invite_code (valid code from a user)
      const inviteUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?invite_code=eq.${encodeURIComponent(code)}&select=invite_code&limit=1`;
      const inviteRes = await fetch(inviteUrl, { headers });
      if (inviteRes.ok) {
        const inviteRows = await inviteRes.json();
        if (!Array.isArray(inviteRows) || inviteRows.length === 0) {
          setInviteCodeError(
            "Nice try. You can't just make up a code, you need a current user to give you their personal invite code. Remove to sign up without one.",
          );
          return false;
        }
      } else if (inviteRes.status === 400) {
        // 400 indicates the code format is invalid (not a UUID for a UUID field)
        // Treat this as an invalid code
        setInviteCodeError(
          "Nice try. You can't just make up a code, you need a current user to give you their personal invite code. Remove to sign up without one.",
        );
        return false;
      }

      return true;
    } catch (e) {
      console.error("Error validating invite code:", e);
      return true; // Don't block on validation error, let backend handle it
    }
  };
  useEffect(() => {
    const el = tosRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    setTosScrolledEnd(atBottom);
  }, []);
  const canSubmit = agree && tosScrolledEnd;

  return (
    <section className="container mx-auto px-4 py-6 nightmode_nocards">
      <h1 className="mb-6 text-center uppercase font-sans text-[40px] leading-none text-slate-800">
        JOIN
      </h1>

      <div className="max-w-xl mx-auto space-y-3">
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-slate-700"
          >
            User Name{" "}
            <span className="ml-2 text-xs text-slate-500">
              (Unable to be changed once submitted)
            </span>
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>

        <div>
          <label
            htmlFor="inviteCode"
            className="block text-sm font-medium text-slate-700"
          >
            Invite Code{" "}
            <span className="ml-2 text-xs text-slate-500">
              (If a friend sent you a special invite code, enter it here)
            </span>
          </label>
          <input
            id="inviteCode"
            name="inviteCode"
            type="text"
            value={inviteCode}
            onChange={(e) => {
              setInviteCode(e.target.value);
              if (e.target.value.trim()) {
                validateInviteCode(e.target.value);
              } else {
                setInviteCodeError("");
              }
            }}
            className={`mt-1 w-full h-10 rounded-md border ${inviteCodeError ? "border-red-500" : "border-slate-300"} bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900/10`}
          />
          {inviteCodeError && (
            <p className="mt-1 text-xs text-red-600">{inviteCodeError}</p>
          )}
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">
            Terms of Service
          </div>
          <div
            ref={tosRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const atBottom =
                el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
              if (atBottom) setTosScrolledEnd(true);
            }}
            className="h-60 w-full rounded-md border border-slate-300 bg-white p-3 text-xs text-slate-700 overflow-y-auto"
          >
            <p>
              <strong>Effective Date:</strong> 15 September 2025
            </p>
            <p>
              <strong>Company:</strong> Cornerstone Digital Sports Limited
              (“Cornerstone,” “we,” “our,” or “us”)
            </p>
            <p className="mt-3">
              These Terms of Service (“Terms”) govern your access to and use of
              the Cornerstone Digital Sports platform, including digital sports
              collectibles, mock platform currency, and related services
              (collectively, the “Services”). By accessing or using the
              Services, you agree to be bound by these Terms. If you do not
              agree, do not use the Services.
            </p>
            <p className="mt-3">
              <strong>1. Eligibility</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                The Services are currently in <strong>beta testing</strong> and
                provided for evaluation purposes only.
              </li>
              <li>
                While no jurisdiction restrictions apply at this stage, you are
                solely responsible for compliance with your local laws.
              </li>
            </ul>
            <p className="mt-3">
              <strong>2. Accounts &amp; Registration</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                To use the Services, you may need to create an account and
                connect a digital wallet.
              </li>
              <li>
                You agree to provide accurate and complete information and to
                keep your account credentials secure.
              </li>
              <li>
                Cornerstone reserves the right to suspend or terminate accounts
                that violate these Terms.
              </li>
            </ul>
            <p className="mt-3">
              <strong>3. Platform Scope</strong>
            </p>
            <p>The Services may include:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Minting and purchasing of digital sports collectibles.</li>
              <li>Marketplace trading and peer-to-peer resales.</li>
              <li>NFT pack drops.</li>
              <li>
                Staking, rewards, and mock currency transactions using the{" "}
                <strong>COR token</strong> (test-phase).
              </li>
            </ul>
            <p className="mt-3">
              At this beta stage, all COR tokens are{" "}
              <strong>mock currency</strong> with no fiat or cryptocurrency
              value. They are used solely to simulate the live economy.
            </p>
            <p className="mt-3">
              <strong>4. Ownership &amp; User Rights</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                When you obtain a digital collectible, you own the token
                associated with that collectible.
              </li>
              <li>
                You receive a <strong>personal, non-commercial license</strong>{" "}
                to display and use the content associated with the collectible.
              </li>
              <li>
                You do not receive any intellectual property rights in
                underlying videos, audio, trademarks, or likenesses.
              </li>
              <li>
                In this beta phase, all video and audio is license-free and
                provided only for testing purposes.
              </li>
            </ul>
            <p className="mt-3">
              <strong>5. Transactions &amp; Fees</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Transactions may include loot box purchases and peer-to-peer
                trades.
              </li>
              <li>
                Cornerstone may take a transaction fee on marketplace sales and
                primary NFT sales purchases.
              </li>
              <li>
                All transactions are final.{" "}
                <strong>No refunds or reversals are permitted.</strong>
              </li>
            </ul>
            <p className="mt-3">
              <strong>6. User Conduct</strong>
            </p>
            <p>You agree not to:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Use the Services for unlawful activity, including money
                laundering or fraud.
              </li>
              <li>
                Use bots, automation, or exploit bugs to gain unfair advantage.
              </li>
              <li>Harass, abuse, or interfere with other users’ experience.</li>
              <li>
                Attempt to disrupt, hack, or reverse engineer the Services.
              </li>
            </ul>
            <p className="mt-3">
              Cornerstone may suspend or terminate your account for violations
              at its sole discretion.
            </p>
            <p className="mt-3">
              <strong>7. Disclaimers &amp; Risks</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <strong>Volatility:</strong> The value of digital assets can
                fluctuate significantly, and may have no prescribed inherent
                value.
              </li>
              <li>
                <strong>Loss Risk:</strong> You are solely responsible for
                safeguarding your wallet and private keys. Loss of access means
                loss of assets.
              </li>
              <li>
                <strong>Technology Risk:</strong> Cornerstone is not liable for
                smart contract bugs, blockchain outages, third-party wallet
                failures, or other technical issues.
              </li>
              <li>
                <strong>Beta Testing:</strong> As a beta product, the Services
                are provided <strong>“as-is” without any warranties</strong> of
                performance, security, or availability.
              </li>
            </ul>
            <p className="mt-3">
              <strong>8. Privacy &amp; Confidentiality</strong>
            </p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                <strong>Confidential Information.</strong> As part of
                participating in the beta testing program, you may have access
                to certain non-public information about Cornerstone Digital
                Sports, including but not limited to platform features, digital
                assets, designs, user interfaces, functionality, pricing
                structures, test data, and related documentation (“Confidential
                Information”).
              </li>
              <li>
                <strong>Non-Disclosure Obligation.</strong> You agree that you
                will not disclose, publish, distribute, or otherwise make
                available any Confidential Information to any third party
                without the prior written consent of Cornerstone. You further
                agree not to make recordings, screenshots, or external
                communications concerning the Services or Confidential
                Information except for the purpose of providing feedback
                directly to Cornerstone.
              </li>
              <li>
                <strong>Permitted Use.</strong> You may use Confidential
                Information solely for the purpose of accessing and testing the
                Services as part of the beta program.
              </li>
              <li>
                <strong>Duration.</strong> Your obligations of confidentiality
                shall remain in effect during your participation in the beta
                testing program and for a period of three (3) years following
                the termination of your access to the Services.
              </li>
              <li>
                <strong>Exclusions.</strong> Confidential Information does not
                include information that: (i) is or becomes publicly known
                through no breach of these Terms; (ii) is lawfully received by
                you from a third party without restriction; or (iii) is
                independently developed by you without use of Confidential
                Information.
              </li>
            </ol>
            <p className="mt-3">
              <strong>9. Termination</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Cornerstone may suspend or terminate your access at any time for
                violations of these Terms or for any reason in its discretion.
              </li>
              <li>
                Upon termination, your rights to access the Services and use
                collectibles may cease.
              </li>
            </ul>
            <p className="mt-3">
              <strong>10. Dispute Resolution</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                These Terms shall be governed by and construed under the laws of
                the Commonwealth of Pennsylvania.
              </li>
              <li>
                Any dispute arising under these Terms shall be resolved by
                binding arbitration in Pennsylvania, unless arbitration is
                unavailable, in which case the courts of Pennsylvania shall have
                exclusive jurisdiction.
              </li>
            </ul>
            <p className="mt-3">
              <strong>11. Limitation of Liability</strong>
            </p>
            <p>To the fullest extent permitted by law:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Cornerstone shall not be liable for indirect, incidental,
                special, or consequential damages.
              </li>
            </ul>
            <p className="mt-3">
              <strong>12. Changes to Terms</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Cornerstone may update these Terms at any time.</li>
              <li>
                Continued use of the Services after updates constitutes your
                acceptance of the revised Terms.
              </li>
            </ul>
            <p className="mt-3">
              <strong>13. Contact</strong>
            </p>
            <p>For questions, feedback, or concerns, please contact us at:</p>
            <p>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:contact@cornerstonedigitalsports.com"
                className="text-slate-800 underline"
              >
                contact@cornerstonedigitalsports.com
              </a>
            </p>
            <p className="mt-3">
              By selecting "I agree" above I confirm that I am over 13 years of
              age, and am a resident of a country where Cornerstone Digital
              Sports is legally permitted to operate.
            </p>
          </div>
        </div>

        <label
          htmlFor="agree"
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <input
            id="agree"
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="h-4 w-4 accent-[#220fff]"
          />
          <span className="text-sm text-slate-800">I agree.</span>
        </label>

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={async () => {
            if (!canSubmit || submitting) return;
            setSubmitting(true);
            try {
              const baseUrl = (import.meta as any).env.SUPABASE_URL as
                | string
                | undefined;
              const anonKey = (import.meta as any).env
                .SUPABASE_ANON_KEY as string | undefined;
              if (!baseUrl || !anonKey) {
                alert("Supabase not configured");
                return;
              }
              const wallet = account?.address || null;
              const u = username.trim();
              if (!wallet) {
                alert("Connect a wallet");
                return;
              }
              if (!u) {
                alert("Enter a username");
                return;
              }
              if (looksOffensive(u)) {
                alert(
                  "offensive user names violate the terms of service and are not tolerated here).",
                );
                return;
              }
              // Validate invite code if one is provided (it's optional)
              if (inviteCode.trim()) {
                const isValid = await validateInviteCode(inviteCode);
                if (!isValid) {
                  return;
                }
              }
              const headers = {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                Accept: "application/json",
                "Content-Type": "application/json",
              } as Record<string, string>;
              // Preflight username uniqueness
              const checkUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?username=eq.${encodeURIComponent(u)}&select=username&limit=1`;
              const chkRes = await fetch(checkUrl, { headers });
              if (!chkRes.ok) {
                const t = await chkRes.text().catch(() => "");
                throw new Error(`check username failed${t ? ": " + t : ""}`);
              }
              const chk = await chkRes.json();
              if (Array.isArray(chk) && chk.length > 0) {
                alert("Username is taken");
                return;
              }
              // RPC upsert and complete
              const rpc = async (fn: string, body: any) => {
                const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`;
                const res = await fetch(url, {
                  method: "POST",
                  headers,
                  body: JSON.stringify(body),
                });
                if (!res.ok) {
                  const t = await res.text().catch(() => "");
                  throw new Error(`${fn} failed${t ? ": " + t : ""}`);
                }
                return res.json();
              };
              const upsertRes = await rpc("create_or_update_profile", {
                p_wallet_address: wallet,
                p_email: null,
                p_email_source: "none",
                p_email_verified: false,
                p_signup_code: inviteCode.trim() || null,
                p_analytics_optout: analyticsOptout,
              });
              const profileId = upsertRes;
              await rpc("complete_profile", {
                p_internal_userid: profileId,
                p_username: u,
              });
              // Update analytics status based on user preference
              updateAnalyticsStatus(!analyticsOptout);
              window.location.href = "/onboarding1";
            } catch (e: any) {
              alert(e?.message || "Error submitting");
            } finally {
              setSubmitting(false);
            }
          }}
          className={`w-full py-2.5 md:py-3 rounded-md font-sans font-medium shadow-sm ${!canSubmit || submitting ? "bg-slate-300 text-black cursor-not-allowed" : "bg-[#220fff] text-white"}`}
        >
          Submit
        </button>

      </div>
    </section>
  );
}
