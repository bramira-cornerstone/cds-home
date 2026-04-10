/**
 * Blog Post Alerts Utility
 * Fetches blog posts from RSS feed and generates alerts for new posts
 * Stores alerts in Supabase public.alerts table
 */

import { fetchBlogPosts, type BlogPost } from "@/lib/blogFetch";
import { type AlertItem } from "@/lib/alerts";
import {
  insertAlerts,
  fetchAlertsForWallet,
} from "@/lib/supabaseAlertsClient";

const BLOG_ALERTS_CACHE_KEY = "blogAlertsCache";

export interface BlogAlertData {
  link: string;
  published: string;
}

/**
 * Get cached blog post links (for reference only, not used for blocking)
 */
function getCachedBlogLinks(): Set<string> {
  try {
    const cached = localStorage.getItem(BLOG_ALERTS_CACHE_KEY);
    if (!cached) return new Set();
    const links = JSON.parse(cached) as string[];
    return new Set(links);
  } catch {
    return new Set();
  }
}

/**
 * Clear the blog alerts cache (used to reset stale cache)
 */
export function clearBlogAlertsCache(): void {
  try {
    localStorage.removeItem(BLOG_ALERTS_CACHE_KEY);
  } catch (err) {
    // silently ignore errors
  }
}

/**
 * Update cached blog post links
 */
function updateBlogLinksCache(links: string[]) {
  try {
    localStorage.setItem(BLOG_ALERTS_CACHE_KEY, JSON.stringify(links));
  } catch (err) {
    // silently ignore errors
  }
}

/**
 * Generate blog post alerts for new posts
 * Returns alerts for each new blog post discovered
 */
export async function generateBlogPostAlerts(
  walletAddress: string,
): Promise<AlertItem[]> {
  try {
    if (!walletAddress) return [];

    // Fetch current blog posts
    const currentPosts = await fetchBlogPosts();
    if (currentPosts.length === 0) {
      return [];
    }

    // Get existing alerts from Supabase to avoid duplicates
    // Supabase is now the source of truth for blog alerts
    const existingAlerts = await fetchAlertsForWallet(walletAddress);
    const existingBlogAlertIds = new Set(
      existingAlerts
        .filter((a) => a.id.startsWith("blog-post:"))
        .map((a) => a.id),
    );

    // Find new blog posts (not already alerted in Supabase)
    const newAlerts: AlertItem[] = [];
    const currentLinks: string[] = [];

    for (const post of currentPosts) {
      const alertId = `blog-post:${post.link}`;
      currentLinks.push(post.link);

      // Skip if already alerted in Supabase
      if (existingBlogAlertIds.has(alertId)) {
        continue;
      }

      // Create alert for new post
      newAlerts.push({
        id: alertId,
        title: "A new blog post has been published",
        body: JSON.stringify({
          message: "Click here to learn more",
          blogUrl: post.link,
          postTitle: post.title,
        }),
        createdAt: new Date(post.published).getTime(),
      });
    }

    // Update cache with all current links (for reference only, Supabase is source of truth)
    updateBlogLinksCache(currentLinks);

    return newAlerts;
  } catch (err) {
    return [];
  }
}

/**
 * Sync blog post alerts for a wallet
 * Adds new blog post alerts to Supabase without duplicating
 */
export async function syncBlogPostAlerts(
  walletAddress: string,
): Promise<void> {
  try {
    if (!walletAddress) {
      return;
    }

    // Normalize address for consistent storage
    const normalizedAddress = walletAddress.toLowerCase();

    // Generate new blog post alerts
    const newBlogAlerts = await generateBlogPostAlerts(normalizedAddress);

    if (newBlogAlerts.length === 0) {
      return;
    }

    // Insert new blog alerts to Supabase
    try {
      await insertAlerts(normalizedAddress, newBlogAlerts);
    } catch (insertErr) {
      // Silently ignore insertion errors
    }
  } catch (err) {
    // Silently ignore all errors - blog alerts are non-critical
  }
}
