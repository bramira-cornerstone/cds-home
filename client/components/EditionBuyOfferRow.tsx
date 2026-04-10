import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FilterStyleButton } from "@/components/ui/filter-style-button";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";


export default function EditionBuyOfferRow({
  className = "",
  editionId = null,
  isSerialPage = false,
  ownerAddress = null,
  connectedWalletAddress = null,
  currentTokenId = null,
  serial = null,
  onStakeClick = null,
  onListClick = null,
}: {
  className?: string;
  editionId?: number | null;
  isSerialPage?: boolean;
  ownerAddress?: string | null;
  connectedWalletAddress?: string | null;
  currentTokenId?: number | null;
  serial?: number | null;
  onStakeClick?: (() => void) | null;
  onListClick?: (() => void) | null;
}) {
  const navigate = useNavigate();
  const account = useActiveAccount();
  const { listings } = useActiveListings();
  const { auctions } = useActiveAuctions();

  const userIsAuctionCreator = useMemo(() => {
    if (!isSerialPage || !account || !editionId || serial == null) {
      return false;
    }

    const userAddress = account.address.toLowerCase();
    return auctions.some(
      (auction) =>
        auction.editionId === editionId &&
        auction.serial === serial &&
        auction.auctionCreator.toLowerCase() === userAddress,
    );
  }, [isSerialPage, account, editionId, serial, auctions]);

  const isOwner = useMemo(() => {
    if (!isSerialPage) {
      return false;
    }

    if (!connectedWalletAddress || ownerAddress == null) {
      return false;
    }

    if (ownerAddress.toUpperCase() === connectedWalletAddress.toUpperCase()) {
      return true;
    }

    if (userIsAuctionCreator) {
      return true;
    }

    return false;
  }, [
    isSerialPage,
    ownerAddress,
    connectedWalletAddress,
    userIsAuctionCreator,
  ]);

  const hasActiveListing = useMemo(() => {
    if (!isSerialPage || !editionId || serial == null) {
      return false;
    }

    // Check for direct listings
    if (listings.length > 0) {
      const matchingListing = listings.find(
        (listing) =>
          listing.editionId === editionId &&
          listing.serial === serial &&
          listing.listingType === "direct",
      );
      if (matchingListing) return true;
    }

    // Check for auctions created by the current user
    if (account && auctions.length > 0) {
      const userAddress = account.address.toLowerCase();
      const matchingAuction = auctions.find(
        (auction) =>
          auction.editionId === editionId &&
          auction.serial === serial &&
          auction.auctionCreator.toLowerCase() === userAddress,
      );
      if (matchingAuction) return true;
    }

    return false;
  }, [isSerialPage, editionId, serial, listings, auctions, account]);

  const handleListClick = () => {
    if (!editionId || !connectedWalletAddress) return;

    if (isSerialPage) {
      if (!serial) return;
      navigate(`/edition/${editionId}/serial/${serial}/manage-listing`);
    } else {
      if (!currentTokenId) return;
      navigate(`/box/${currentTokenId}/manage-listing`);
    }
  };

  if (!isSerialPage || !isOwner) {
    return null;
  }

  return (
    <div
      className={`w-full ${className}`}
      style={{
        marginTop: "1px",
      }}
    >
      <div
        className="grid grid-cols-3 gap-2 items-stretch"
      >
        <FilterStyleButton
          className="w-full px-3 py-1.5 text-[20px]"
          aria-label="All"
          style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }}
          onClick={() => {
            if (editionId) {
              navigate(`/edition/${editionId}`);
            }
          }}
        >
          ALL
        </FilterStyleButton>
        <FilterStyleButton
          className="w-full px-3 py-1.5 text-[20px]"
          aria-label={hasActiveListing ? "Manage Listing" : "Sell"}
          style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }}
          onClick={() => {
            if (onListClick) {
              onListClick();
            } else {
              handleListClick();
            }
          }}
        >
          {hasActiveListing ? "MANAGE LISTING" : "SELL"}
        </FilterStyleButton>
        <FilterStyleButton
          className="w-full px-3 py-1.5 text-[20px]"
          aria-label="Stake"
          style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }}
          onClick={() => {
            if (onStakeClick) {
              onStakeClick();
            } else if (editionId && serial != null) {
              navigate(`/edition/${editionId}/serial/${serial}/stake`);
            }
          }}
        >
          STAKE
        </FilterStyleButton>
      </div>
    </div>
  );
}
