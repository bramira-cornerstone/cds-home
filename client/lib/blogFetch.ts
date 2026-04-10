export interface BlogPost {
  title: string;
  link: string;
  published: string;
  author: string;
  summary: string;
  image?: string;
}

export async function fetchBlogPosts(
  signal?: AbortSignal,
): Promise<BlogPost[]> {
  try {
    // Early exit if already aborted
    if (signal?.aborted) {
      return [];
    }

    const blogFeedUrl =
      "https://cornerstonedigitalsports.blogspot.com/feeds/posts/default";

    let responseText: string;
    let success = false;

    // Try multiple CORS proxies - different services with different reliability
    const proxies = [
      {
        url: `https://api.allorigins.win/raw?url=${encodeURIComponent(blogFeedUrl)}`,
        name: "allorigins.win"
      },
      {
        url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(blogFeedUrl)}`,
        name: "codetabs.com"
      },
      {
        url: `https://thingproxy.freeboard.io/fetch/${blogFeedUrl}`,
        name: "thingproxy.freeboard.io"
      },
      {
        url: `https://corsproxy.io/?${encodeURIComponent(blogFeedUrl)}`,
        name: "corsproxy.io"
      },
    ];

    for (const proxy of proxies) {
      // Check if external signal is already aborted
      if (signal?.aborted) {
        return [];
      }

      try {
        // Set a timeout for each proxy attempt (10 seconds)
        const controller = new AbortController();
        let timeoutId: NodeJS.Timeout | null = null;
        let externalAbortHandler: (() => void) | null = null;

        try {
          // Listen for external signal abort
          if (signal) {
            externalAbortHandler = () => {
              try {
                controller.abort();
              } catch (e) {
                // Ignore errors during abort
              }
            };
            try {
              // Only add listener if signal is not already aborted
              if (!signal.aborted) {
                signal.addEventListener("abort", externalAbortHandler);
              }
            } catch (e) {
              // Signal might already be aborted or listener might fail, that's fine
              externalAbortHandler = null;
            }
          }

          // Set timeout if signal is not already aborted
          if (!signal?.aborted) {
            timeoutId = setTimeout(() => {
              try {
                controller.abort();
              } catch (e) {
                // Ignore errors during abort
              }
            }, 10000);
          }

          // Check one more time before fetching
          if (signal?.aborted) {
            if (timeoutId) clearTimeout(timeoutId);
            if (externalAbortHandler && signal && !signal.aborted) {
              try {
                signal.removeEventListener("abort", externalAbortHandler);
              } catch (e) {
                // Ignore removal errors
              }
            }
            continue;
          }

          const response = await fetch(proxy.url, {
            signal: controller.signal,
            headers: {
              "Accept": "application/atom+xml,application/rss+xml,application/xml",
              "User-Agent": "Mozilla/5.0",
            },
          });

          if (timeoutId) clearTimeout(timeoutId);
          if (externalAbortHandler && signal) {
            try {
              signal.removeEventListener("abort", externalAbortHandler);
            } catch (e) {
              // Ignore removal errors
            }
          }

          if (response.ok) {
            responseText = await response.text();
            success = true;
            break;
          } else {
            // Response failed, try next proxy
            continue;
          }
        } catch (innerErr) {
          // Clean up before handling error
          if (timeoutId) clearTimeout(timeoutId);
          if (externalAbortHandler && signal) {
            try {
              signal.removeEventListener("abort", externalAbortHandler);
            } catch (e) {
              // Ignore cleanup errors
            }
          }

          // Check if this is an abort error
          if (innerErr instanceof Error && innerErr.name === "AbortError") {
            // Silently handle abort errors
            if (signal?.aborted) {
              return []; // Exit if external signal was aborted
            }
            // Timeout or internal abort, continue to next proxy
            continue;
          }

          // Re-throw for outer catch to handle
          throw innerErr;
        }
      } catch (err) {
        // Silently suppress all abort and network errors
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            // Silently handle abort errors
            if (signal?.aborted) {
              return [];
            }
            // Timeout fired, continue to next proxy
            continue;
          }
          if (err.message?.includes("Failed to fetch") || err.message?.includes("fetch")) {
            // Network errors, continue to next proxy
            continue;
          }
        }
        // All other errors, continue to next proxy silently
        continue;
      }
    }

    if (!success) {
      return [];
    }

    // Parse Atom feed using DOMParser for better performance and reliability
    const entries: BlogPost[] = [];

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(responseText, "application/xml");

      // Check for parsing errors
      if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        return [];
      }

      const entryElements = xmlDoc.getElementsByTagName("entry");

      for (let i = 0; i < Math.min(entryElements.length, 10); i++) {
        const entry = entryElements[i];

        // Extract title
        const titleEl = entry.querySelector("title");
        const title = titleEl?.textContent?.trim() || "Untitled";

        // Extract link - look for alternate HTML link
        let link = "";
        const links = entry.querySelectorAll("link");
        links.forEach((linkEl) => {
          if (linkEl.getAttribute("rel") === "alternate" &&
              linkEl.getAttribute("type") === "text/html" &&
              !linkEl.getAttribute("href")?.includes("replies")) {
            link = linkEl.getAttribute("href") || "";
          }
        });

        // Extract summary
        const summaryEl = entry.querySelector("summary");
        const summary = summaryEl?.textContent?.substring(0, 200) || "";

        // Extract published date
        const publishedEl = entry.querySelector("published");
        const published = publishedEl?.textContent || new Date().toISOString();

        // Extract image - Blogspot embeds images in content and summary
        let image: string | undefined;

        // Get the raw HTML content from summary (contains escaped HTML with images)
        const summaryHtml = summaryEl?.textContent || "";

        // Try to extract img src from the HTML string
        const imgMatch = /<img[^>]+src=['"]([^'"]*)['"]/i.exec(summaryHtml);
        if (imgMatch?.[1]) {
          image = imgMatch[1];
        }

        // Try media:thumbnail with namespace as fallback
        if (!image) {
          const allChildren = entry.children;
          for (let j = 0; j < allChildren.length; j++) {
            const child = allChildren[j];
            if (child.localName === "thumbnail" && child.getAttribute("url")) {
              image = child.getAttribute("url") || undefined;
              break;
            }
          }
        }

        // Try img in content as final fallback
        if (!image) {
          const contentEl = entry.querySelector("content");
          if (contentEl) {
            const contentHtml = contentEl.textContent || "";
            const contentImgMatch = /<img[^>]+src=['"]([^'"]*)['"]/i.exec(
              contentHtml
            );
            if (contentImgMatch?.[1]) {
              image = contentImgMatch[1];
            }
          }
        }

        // Only add if we have a valid link and title
        if (link && title !== "Untitled") {
          const post: BlogPost = {
            title,
            link,
            published,
            author: "Cornerstone Digital Sports",
            summary: cleanHtmlSummary(summary),
          };
          if (image) {
            post.image = image;
          }
          entries.push(post);
        }
      }
    } catch (parseErr) {
      return [];
    }

    return entries;
  } catch (error) {
    return [];
  }
}

function cleanHtmlSummary(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  if (text.length > 200) {
    return text.substring(0, 200).replace(/\s+\S*$/, "") + "...";
  }

  return text;
}

export function formatPublishDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}
