/**
 * Invite Code Validation Configuration
 *
 * When enabled (default: true):
 * - Validates that public.profiles.signup_code is unique on /join page
 * - Filters out marketplace records where the connected wallet address matches
 *   auction_creator, seller, or listing_creator in the "They bought a box or relic" validation
 *
 * When disabled (false):
 * - Skips signup_code uniqueness validation on /join page
 * - Does not filter marketplace records based on wallet address role
 */

export const INVITE_CODE_VALIDATION_ENABLED = false;
