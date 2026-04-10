import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import {
  fetchBlogPosts,
  formatPublishDate,
  type BlogPost,
} from "@/lib/blogFetch";

function BlogPostCard({ post }: { post: BlogPost }) {
  return (
    <a
      href={post.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="h-full rounded-lg border border-slate-200 bg-white overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 hover:border-slate-300 flex flex-col">
        {post.image && (
          <div className="relative w-full h-48 overflow-hidden bg-slate-100">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
              onError={(e) => {
                // Hide image if it fails to load
                e.currentTarget.parentElement?.style.setProperty(
                  "display",
                  "none",
                );
              }}
            />
          </div>
        )}
        <div className="p-6 flex-1 flex flex-col">
          <h2 className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2 line-clamp-2">
            {post.title}
          </h2>
          <div className="text-sm text-slate-600 mb-3">
            {formatPublishDate(post.published)}
            {post.author && (
              <>
                {" • "}
                <span className="font-medium">{post.author}</span>
              </>
            )}
          </div>
          <p className="text-slate-700 text-sm line-clamp-3 mb-auto">
            {post.summary}
          </p>
          <div className="flex items-center text-blue-600 font-semibold text-sm group-hover:gap-2 transition-all mt-4">
            Read More
            <svg
              className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function InfoBlogPage() {
  const betaAllowlist = useBetaAllowlist();
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: ({ signal }) => fetchBlogPosts(signal),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: true, // Temporarily deactivated betaAllowlist check
  });

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
    <section className="container mx-auto px-4 py-6">
      <h1 className="mb-12 text-center uppercase font-sans text-[40px] leading-none text-slate-800 dark:text-white">
        BLOG
      </h1>

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-slate-600">Loading blog posts...</div>
        </div>
      ) : posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {posts.map((post, index) => (
            <BlogPostCard key={`${post.link}-${index}`} post={post} />
          ))}
        </div>
      ) : (
        <div className="flex justify-center items-center py-16">
          <div className="text-slate-600 text-center">
            <p className="mb-2">No blog posts available yet.</p>
            <p className="text-sm">Check back soon for updates!</p>
          </div>
        </div>
      )}
    </section>
  );
}
