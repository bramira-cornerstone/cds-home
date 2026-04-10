import { useEffect, useMemo, useState } from "react";
import MiniCarousel from "@/components/MiniCarousel";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import { useQuery } from "@tanstack/react-query";
import { fetchBlogPosts, type BlogPost } from "@/lib/blogFetch";
import { Link } from "react-router-dom";
import { ComingSoonModal } from "@/components/ComingSoonModal";
import { Copy, Check, X } from "lucide-react";

function FAQSection() {
  const faqItems = [
    {
      question:
        "I'm new to this stuff. What is a digital collectible? Are they even real?",
      answer: (
        <>
          <p>
            They are real, and they have value. They are the next generation of
            sports cards that go beyond static images. They can be bought and
            sold on a marketplace with your fellow collectors all over the
            world, 24 hours a day, 7 days a week. They won't accidentally get
            damaged and lose half their value. They can't be counterfeited, and
            you can't be scammed where the seller takes your money and never
            sends your card in the mail. So in many ways you can be sure they're
            more real than any physical collectible.
          </p>
          <p>
            Digital collectibles here at Cornerstone Digital Sports are 3d
            models featuring your favorite sports highlights, with their
            scarcity, market conditions, and owner's name displayed right on
            the model. You can buy, sell, hold, interact with them, and earn
            things from them. Each has a unique serial number, and its
            authenticity is secured via transparent public ledger via the
            Polygon blockchain. They won't sit in a drawer collecting dust,
            instead they come with you in your pocket to show your friends and
            share online.
          </p>
        </>
      ),
    },
    {
      question:
        "What exactly is the collectible and what exactly do you do here?",
      answer: (
        <div>
          <p>
            Cornerstone Digital Sports is different than any other digital sports
            collectible on the market.
          </p>
          <br />
          <p>
            The first thing you'll notice is how the product looks. It is a 3d
            representation of a physical product. It feels like something you can
            hold in your hand. And it reacts to your ownership of it, stamping
            your username on the front. It reacts to the market on the back. But
            unlike physical collectibles like sports cards it's the video
            highlight of the actual event we can all relive. It's not a picture of
            the player where we aren't sure what game it's even from.
          </p>
          <br />
          <p>
            Next you'll notice how the weekly activities are different here. Users
            vote to decide what new supply gets released and at what scarcity
            level, not us. Then you can compete to redeem any of that team's old
            Relics for their new one. Then the users who supported the market the
            most are given first crack at the higher tier boxes of Relics. Then
            once a year, every single team's fans will get rewarded for those who
            staked (locked up for a year) the most value in their team, and in a
            way that is accessible to more than just the very top accounts. From
            there enjoying and showing off your collection, connecting with fellow
            collectors, giving your feedback and what you want put up for votes,
            and helping to build a healthy marketplace here are the activities
            you'll see users engaged in.
          </p>
        </div>
      ),
    },
    {
      question:
        "How do you manage the product itself in a way that I can understand and make confident buying decisions?",
      answer: (
        <div>
          <p>
            We take our motto 'Where fans have the power' seriously. All of it
            runs automatically without our hand in it constantly tweaking for
            what we want. User votes decide what gets minted. Dynamic user
            demand decides the price of new boxes. Sets and their mint counts
            will be the same year in and year out. Calculated percentiles decide
            the gates for gaining allowlist access to higher tier boxes. Median
            market sale prices decide the utility value of collectibles. All of
            it automated, without our hand in it constantly tweaking it to get
            what we want.
          </p>
          <br />
          <p>We don't curate, we facilitate.</p>
          <br />
          <p>We operate on the 10 Cornerstone Commandments:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              We don't release things you don't want just to fill out packs;
              fans and collectors here decide.
            </li>
            <li>
              We don't drive you to collect things they don't want to earn the
              ones you might.
            </li>
            <li>
              We don't reward new supply of player A for collecting player B.
            </li>
            <li>
              We will never raise future mint counts to cash out on increased
              demand when it comes, diluting all of our prior collectors.
            </li>
            <li>
              We will never do the opposite and decrease mint counts to try to
              make new releases look better than old in an effort to drum up
              demand.
            </li>
            <li>
              We don't systematically reward anything that the market doesn't
              decide it wants already, like bottlenecks.
            </li>
            <li>
              We don't build release models that reward gambling or luck over
              collecting and supporting the marketplace to get ahead.
            </li>
            <li>
              We don't manipulate which players get utility. User votes decide
              redemptions and all players get airdrops.
            </li>
            <li>
              We will never build a product that undermines collector value by
              reducing your cherished and memorable sports collectibles to cheap
              game pieces. Engagement here will always support the collector
              economy.
            </li>
            <li>
              We don't do cats or monkeys or mythical creatures or cartoon
              characters... we just do sports. Because to us, it's not all the same.
            </li>
          </ol>
        </div>
      ),
    },
    {
      question:
        "How do I know you're not going to make some random change that ruins the value of my collectibles?",
      answer: (
        <div>
          <p>
            We agree. That's why we've started this product. We never found it
            fun to collect one thing we loved, then have the product's design
            tell us that we need to chase some other thing for a reward. Worse
            yet to stick around to do it, only to have the product then change
            to prop up some other thing they wanted to drive demand for.
          </p>
          <br />
          <p>
            Here we say "Collecting IS the utility". The more you collect, the
            better position you'll be in to purchase higher-tier Boxes before
            their Relics hit the open market. And we will never directly provide
            rewards in one team to those who collected a different one. Utility
            to redeem Relics for one team will always be the only way to claim
            that team's new Relic. We make utility to for staking your favorite
            team's Relics easy for an entry-level fan to attain, and not as
            giveaways to the top dormant accounts only.
          </p>
          <br />
          <p>
            The levels to attain these will never be set or changed by us; they
            are always set in relation to your fellow fans and collectors, and
            how much value they place on earning that reward. Consistency of
            utility offers greater confidence buying, and you'll find that here.
          </p>
        </div>
      ),
    },
    {
      question:
        "How do I know you're not going to dilute the value of a player I hold after I buy?",
      answer: (
        <div>
          <p>
            This was the reason we wanted to build this product for you: to solve
            the conflict between users who bought a player and are now worried the
            business will dilute the value of their collectible by minting more, and
            a business now too afraid and limited to produce exciting new events as
            collectibles so they hold off to be sure until it isn't relevant
            anymore. We've solved it here...
          </p>
          <br />
          <p>
            New supply is minted because more people say that want it, and the more
            people that want it, the more supply they consume from those that hold
            that team's old Relics. And since the utility value is measured in value,
            and we don't offer "collect only one" games, you never need to worry about
            new supply OR utility diluting your value to hold.
          </p>
          <br />
          <p>
            Related, this also means we never point people toward collecting things
            they don't want, just to earn things they do want. So people looking for
            utility and people looking for collectability now are finally looking at
            the same things on the marketplace.
          </p>
        </div>
      ),
    },
    {
      question:
        "How do I get ahead here if all the good packs only go to those at the top?",
      answer: (
        <div>
          <p>
            Here, "good packs" aren't limited to just the ones stamped with Rare
            or Epic tiers. A basic pack still contains highlights fans ranked in
            the top half of demand—real plays that mattered. By anchoring supply
            to authentic demand, we make sure every tier contributes to
            collection value, not just the highest ones. And those are
            accessible (along with highly sought after Cornerstone Premieres) in
            Basic boxes day one to new collectors.
          </p>
          <br />
          <p>
            We built Cornerstone Digital Sports to reward patience, collecting,
            and supporting fellow collectors—not rent-seeking or gambling or
            quick flips. Those who back the ecosystem consistently get first
            dibs on higher-tier drops, in a way that benefits all holders. But
            every collector has access to packs with highlights that fans
            actually want. That's how we protect value for the long term.
          </p>
        </div>
      ),
    },
    {
      question: "How do I load money to buy here? What currency does this use?",
      answer: (
        <div>
          <p>
            During beta testing we are using our platform currency COR. Everyone
            can claim $5,000 free per account in order to test the platform. As
            soon as you claim it during onboarding, or by clicking the icon next
            to your username on your collection page to go to your account page.
            We did not find it fair to ask people to spend real money for an
            unlicensed product with fake teams and fake players.
          </p>
          <br />
          <p>
            However, when the product has a league and player's association
            license, it's also important that we do NOT use a platform currency.
            Platform cryptocurrencies are like real economies: their creators can
            make more whenever they want and release it to "stimulate" the
            economy, but without creating any actual demand to back it up
            eventually that falls like a house of cards. So in the live release, our plan is for the
            marketplace to accept transactions only in USDC stablecoin, 1:1
            pegged to the U.S. dollar. You would be able to use our transactions
            vendor to add to your account balance with a credit card or bank transfer, use that
            USDC to buy and sell in the product, and after completing the required KYC process-
            transfer it back to your bank account as cash.
          </p>
        </div>
      ),
    },
    {
      question:
        "There's a system here I don't fully understand how to use? How do I learn more?",
      answer: (
        <div>
          <p>
            There is no right way or wrong way to use the product. Some people
            want to flip packs, some people want to buy and hold the most
            long-term valuable collectibles, some people want to trade in and
            out for quick profits, some people want to earn top spots on
            leaderboards to be sure they can earn the best new relics from their
            team, and some others just want to come together as a community and
            connect on the matches.
          </p>
          <br />
          <p>
            Check the top of this page for blog posts to read detailed
            walkthroughs of all the platform's features. Then form your own
            strategy and enjoy collecting your way. Our goal is to make that be
            rewarding for you, no matter how you chose to, and to never abuse
            that fandom.
          </p>
          <br />
          <p>
            You can also connect with us and fellow collectors via our social
            accounts and email links below:
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {faqItems.map((item, idx) => (
        <div key={idx}>
          <h3 className="font-bold text-sm text-slate-800 mb-2">
            {item.question}
          </h3>
          {item.answer && (
            <div className="pl-4 text-sm text-slate-700 leading-relaxed prose prose-slate max-w-none font-sans">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function InfoPage() {
  const betaAllowlist = useBetaAllowlist();
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const contactEmail = "contact@cornerstonedigitalsports.com";

  const handleCopyEmail = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(contactEmail);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
        return;
      }

      const textArea = document.createElement("textarea");
      textArea.value = contactEmail;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const success = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (success) {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      }
    } catch (err) {
      console.error("Copy to clipboard failed:", err);
    }
  };

  // Call all hooks unconditionally before any conditional returns
  const { data: blogPosts = [], isLoading: isBlogLoading, error: blogError } = useQuery({
    queryKey: ["info-blog-posts"],
    queryFn: ({ signal }) => fetchBlogPosts(signal),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: true, // Temporarily deactivated betaAllowlist check
  });

  // Debug logging
  useEffect(() => {
    console.log("[InfoPage] Blog posts loaded:", {
      count: blogPosts.length,
      posts: blogPosts.map((p) => ({ title: p.title, hasImage: !!p.image })),
      error: blogError,
    });
  }, [blogPosts, blogError]);

  const carouselItems = useMemo(() => {
    const items = blogPosts.slice(0, 3);
    return items;
  }, [blogPosts]);

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
    <section className="container mx-auto px-4 py-6 nightmode_cards">
      <div className="w-full mb-4">
        <img
          src="https://cdn.builder.io/api/v1/file/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F5da01ce957eb4e6fafc24d9d61b8ffc0"
          alt="Info banner"
          className="w-full h-auto object-cover rounded-md"
        />
      </div>
      <div className="mt-6">
        <div className="font-sans font-bold text-[20px] text-slate-800 mb-2 text-left">
          Blog Posts
        </div>
        <div className="px-1 py-1">
          {isBlogLoading ? (
            <div className="h-[170px] flex items-center justify-center bg-slate-100 rounded-md">
              <div className="text-slate-600">Loading blog posts...</div>
            </div>
          ) : carouselItems.length === 0 ? (
            <div className="h-[170px] flex items-center justify-center bg-slate-100 rounded-md">
              <div className="text-slate-600 text-center">
                <p>No blog posts available</p>
                <p className="text-sm">Check back soon for updates!</p>
              </div>
            </div>
          ) : (
            <MiniCarousel
              count={carouselItems.length + 1}
              itemWidthClass="w-1/4"
              itemContainerClass="flex shrink-0 flex-col w-1/4"
              imageClass="h-full"
              overlayCaption
              containerPaddingClass="px-3"
              gapClass="gap-3"
              overlayTextClassName="absolute inset-0 w-full h-full flex items-center justify-center text-[18px] sm:text-[30px] text-slate-50 text-center pointer-events-none px-2 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] font-medium"
              overlayCaptionInline
              overlayTextStyle={{ textShadow: "5px 5px 10px rgba(0, 0, 0, 0.8)" }}
              caption={(i) => {
                if (i === 0) return "See All";
                if (i > 0 && i <= carouselItems.length) {
                  return carouselItems[i - 1]?.title ?? "";
                }
                return "";
              }}
              mediaForIndex={(i) => {
                if (i > 0 && i <= carouselItems.length && carouselItems[i - 1]?.image) {
                  return {
                    src: carouselItems[i - 1].image!,
                    mediaType: "image",
                  };
                }
                return undefined;
              }}
              itemHrefForIndex={(i) => {
                if (i === 0) {
                  return "/info/blog";
                }
                if (i > 0 && i <= carouselItems.length) {
                  return carouselItems[i - 1]?.link;
                }
                return undefined;
              }}
            />
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="font-sans font-bold text-[20px] text-slate-800 mb-2 text-left">
          Frequently Asked Questions
        </div>
        <FAQSection />
      </div>

      <div className="mt-8 w-full grid grid-cols-3 gap-4 items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsComingSoonOpen(true);
          }}
          className="w-full flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0"
          type="button"
        >
          <div className="h-[100px] w-full flex items-center justify-center">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F2217e5d819ce40e3858a03c0f4cd17cd?format=webp&width=800"
              alt="Discord"
              className="h-[100px] w-full object-contain"
            />
          </div>
          <div className="mt-1 text-center font-sans text-sm text-slate-700">
            Join Our Discord
          </div>
        </button>
        <button
          onClick={() => setIsComingSoonOpen(true)}
          className="w-full flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0"
          type="button"
        >
          <div className="h-[100px] w-full flex items-center justify-center">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2Fcd70ed77318849459dc23a3e92c270d0?format=webp&width=800"
              alt="X / Twitter"
              className="h-[100px] w-full object-contain"
            />
          </div>
          <div className="mt-1 text-center font-sans text-sm text-slate-700">
            Follow us on X
          </div>
        </button>
        <button
          onClick={() => setIsEmailModalOpen(true)}
          className="w-full flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0"
          type="button"
        >
          <div className="h-[100px] w-full flex items-center justify-center">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F0b3450235fcc4a808b921f369e326148?format=webp&width=800"
              alt="Email"
              className="h-[100px] w-full object-contain"
            />
          </div>
          <div className="mt-1 text-center font-sans text-sm text-slate-700">
            Email Us
          </div>
        </button>
      </div>

      <ComingSoonModal
        isOpen={isComingSoonOpen}
        onClose={() => setIsComingSoonOpen(false)}
      />

      {/* Email Contact Modal */}
      {isEmailModalOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setIsEmailModalOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  Contact Us
                </h2>
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="p-1 rounded-md opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </button>
              </div>

              <div className="flex flex-col space-y-4">
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  Email us at:
                </p>
                <div className="flex items-center gap-2 rounded-md mx-auto">
                  <span className="text-sm text-slate-900 dark:text-white mx-auto" style={{fontFamily: "Roboto, sans-serif", fontWeight: "400", lineHeight: "20px"}}>
                    {contactEmail}
                  </span>
                  <button
                    onClick={handleCopyEmail}
                    className="mr-auto p-2 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    aria-label="Copy email"
                    title="Copy to clipboard"
                  >
                    {copiedEmail ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    )}
                  </button>
                </div>

                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => setIsEmailModalOpen(false)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
