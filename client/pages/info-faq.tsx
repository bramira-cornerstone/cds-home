import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";

export default function InfoFaqPage() {
  const betaAllowlist = useBetaAllowlist();
  if (betaAllowlist !== true) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="w-full rounded-none bg-white text-black p-6 text-center text-base">
          Platform is invitation only. Log in and enter your invite code to
          join.
        </div>
      </section>
    );
  }
  const questions = [
    "I'm new to this stuff. What is a digital collectible? Are they even real?",
    "I'm familiar with crypto and NFTs. How decentralized is this? What's on-chain?",
    "What exactly is the collectible and what exactly do you do here?",
    "How do you manage the product itself in a way that I can understand and make confident buying decisions?",
    "How do I know you're not going to make some random change that ruins the value of my collectibles?",
    "How do I know you're not going to dilute the value of a player I hold after I buy?",
    "How do I get ahead here if all the good packs only go to those at the top?",
    "How do you prevent multi-accounting here?",
    "How do I load money to buy here? What currency does this use?",
    "There's a system here I don't fully understand how to use? How do I learn more?",
  ];

  return (
    <section className="container mx-auto px-4 py-6 nightmode_cards">
      <h1 className="mb-6 text-center uppercase font-sans text-[40px] leading-tight text-slate-800 dark:text-white">
        <p>Frequently Asked Questions</p>
      </h1>

      <div className="w-full">
        <Accordion type="single" collapsible className="w-full">
          {questions.map((q, idx) => (
            <AccordionItem key={idx + 1} value={`item-${idx + 1}`}>
              <AccordionTrigger className="relative overflow-hidden text-left font-sans font-normal text-sm w-full bg-white text-black px-4 py-1.5 my-0.5 rounded-none justify-start gap-2 hover:no-underline border border-slate-300 before:content-[''] before:absolute before:inset-0 before:bg-[linear-gradient(to_bottom,_rgba(34,15,255,0.12)_0%,_rgba(34,15,255,0.10)_8%,_rgba(34,15,255,0.06)_12%,_rgba(34,15,255,0.03)_14%,_rgba(34,15,255,0)_15%,_rgba(34,15,255,0)_85%,_rgba(255,130,0,0)_85%,_rgba(255,130,0,0.03)_86%,_rgba(255,130,0,0.06)_88%,_rgba(255,130,0,0.10)_92%,_rgba(255,130,0,0.12)_100%)] before:pointer-events-none">
                <span>
                  <p>{q}</p>
                </span>
              </AccordionTrigger>
              <AccordionContent className="bg-white text-black border border-slate-300 border-t-0 rounded-none">
                <div className="prose prose-slate max-w-none font-sans text-sm leading-relaxed p-4">
                  {idx === 0 ? (
                    <p>
                      Digital collectibles here at Cornerstone Digital Sports
                      are 3d models with your favorite sports highlights, with
                      scarcity and ownership authenticated by a blockchain. You
                      can buy, sell, hold, and interact with them. <br />
                      <br />
                      Each is an NFT, which means non-fungible token.
                      Essentially that each one is not exactly the same. Some
                      early NFTs have been pump and dump scams. Some have been
                      pointless, ugly pictures of creatures. Solutions looking
                      for a problem. But at the heart of it, blockchain
                      technology is just a sustainable public ledger for
                      confirming and authenticating transactions in a
                      transparent way. NFTs are just items that can be confirmed
                      through that blockchain. <br />
                      <br />
                      They are real, and they have value. They are the next
                      generation of sports cards that go beyond static images.
                      They can be bought and sold on a marketplace with your
                      fellow collectors all over the world, 24 hours a day, 7
                      days a week. They won't accidentally get damaged and lose
                      half their value. They can't be counterfeited, and you
                      can't be scammed where the seller takes your money and
                      never sends your card in the mail. They won't sit in a
                      drawer collecting dust, instead they come with you in your
                      pocket to show your friends and share online.
                    </p>
                  ) : idx === 1 ? (
                    <div className="space-y-4">
                      <p>
                        When you sign in to Cornerstone Digital Sports,
                        authentication will create a smart wallet for you. But
                        you are also able to connect your own non-custodial
                        wallet yourself. We currently support over 500 wallets.
                        You can also manage the private keys to your in-app
                        wallet if you'd prefer that.
                      </p>
                      <p>
                        We operate on the Polygon blockchain and transactions
                        are publicly visible via Polygonscan. Minting, buys,
                        sales, listings, de-listings, offers, canceled offers,
                        accepted offers, staking, unstaking, redemptions, and
                        airdrops are all on-chain events. Votes however are not
                        currently planned to be on-chain to prevent expert users
                        from gaining an unfair advantage in redemption events
                        coming. The 3d models of boxes and relics use our own
                        proprietary lighting and state models that we personally
                        think offers a really tactile and engaging way to
                        interact with your collectibles, but all of the data to
                        be able to design them in your own way (composability)
                        is fully public via blockchain metadata and IPFS.
                      </p>
                      <p>
                        Boxes you collect here are ERC-1155 tokens, relics you
                        collect here are ERC-721 tokens, and both are able to be
                        transferred to any marketplace or wallet that supports
                        Polygon NFTs. But do so at your own risk, as Cornerstone
                        Digital Sports can not be held responsible for them once
                        they leave our ecosystem.
                      </p>
                    </div>
                  ) : idx === 2 ? (
                    <p>
                      Cornerstone Digital Sports is different than any other
                      digital sports collectible on the market.
                      <br />
                      <br />
                      The first thing you'll notice is how the product looks. It
                      is a 3d representation of a physical product. It feels
                      like something you can hold in your hand. And it reacts to
                      your ownership of it, stamping your username on the front.
                      It reacts to the market on the back. But unlike physical
                      collectibles like sports cards it's the video highlight of
                      the actual event we can all relive. It's not a picture of
                      the player where we aren't sure what game it's even from.
                      <br />
                      <br />
                      Next you'll notice how the weekly activities are different
                      here. Users vote to decide what to mint, not us. Then that
                      player's old supply gets redeemed for new. Then we drop
                      the most demanded collectibles with those who supported
                      the market the most given first crack at the higher tier
                      ones. Then once a year every single player's fans will get
                      rewarded for those who staked (locked up for a year) the
                      most, and in a way that is accessible to more than just
                      the very top accounts. From there enjoying and showing off
                      your collection, connecting with fellow collectors, and
                      helping to build a healthy marketplace here are the
                      activities you'll see users engaged in.
                    </p>
                  ) : idx === 3 ? (
                    <div>
                      <p>
                        We take our motto 'Where fans have the power' seriously.
                        All of it runs automatically without our hand in it
                        constantly tweaking for what we want. User votes decide
                        what gets minted. Dynamic user demand decides the price
                        of new boxes. Sets and their mint counts will be the
                        same year in and year out. Calculated percentiles decide
                        the gates for gaining allowlist access to higher tier
                        boxes. Median market sale prices decide the utility
                        value of collectibles. All of it automated, without our
                        hand in it constantly tweaking it to get what we want.
                      </p>
                      <br />
                      <p>We don't curate, we facilitate.</p>
                      <br />
                      <p>We operate on the 10 Cornerstone Commandments:</p>
                      <ol className="list-decimal pl-5 space-y-1">
                        <li>
                          We don't release things you don't want just to fill
                          out packs; fans and collectors here decide.
                        </li>
                        <li>
                          We don't drive you to collect things they don't want
                          to earn the ones you might.
                        </li>
                        <li>
                          We don't reward new supply of player A for collecting
                          player B.
                        </li>
                        <li>
                          We will never raise future mint counts to cash out on
                          increased demand when it comes, diluting all of our
                          prior collectors.
                        </li>
                        <li>
                          We will never do the opposite and decrease mint counts
                          to try to make new releases look better than old in an
                          effort to drum up demand.
                        </li>
                        <li>
                          We don't systematically reward anything that the
                          market doesn't decide it wants already, like
                          bottlenecks.
                        </li>
                        <li>
                          We don't build release models that reward gambling or
                          luck over collecting and supporting the marketplace to
                          get ahead.
                        </li>
                        <li>
                          We don't manipulate which players get utility. User
                          votes decide redemptions and all players get airdrops.
                        </li>
                        <li>
                          We will never build a product that undermines
                          collector value by reducing your cherished and
                          memorable sports collectibles to cheap game pieces.
                          Engagement here will always support the collector
                          economy.
                        </li>
                        <li>
                          We don't do cats or monkeys or pins or mythical
                          creatures or eggs... we just do sports. Because to us,
                          it's not all the same.
                        </li>
                      </ol>
                    </div>
                  ) : idx === 6 ? (
                    <div>
                      <p>
                        Here, “good packs” aren’t limited to just the ones
                        stamped with Rare or Epic tiers. A basic pack still
                        contains highlights fans ranked in the top half of
                        demand—real plays that mattered. By anchoring supply to
                        authentic demand, we make sure every tier contributes to
                        collection value, not just the highest ones. And those
                        are accessible (along with highly sought after
                        Cornerstone Premieres) in Basic boxes day one to new
                        collectors.
                      </p>
                      <br />
                      <p>
                        We built Cornerstone Digital Sports to reward patience,
                        collecting, and supporting fellow collectors—not
                        rent-seeking or gambling or quick flips. Those who back
                        the ecosystem consistently get first dibs on higher-tier
                        drops, in a way that benefits all holders. But every
                        collector has access to packs with highlights that fans
                        actually want. That’s how we protect value for the long
                        term.
                      </p>
                    </div>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
