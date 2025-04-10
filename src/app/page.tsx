
"use client";

import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RedditPost, getHotPosts } from "@/services/reddit";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const isValidSubreddit = (subreddit: string): boolean => {
  // Basic validation, can be expanded
  return /^[a-zA-Z0-9_]+$/.test(subreddit);
};

export default function Home() {
  const [subreddits, setSubreddits] = useState<string>('');
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPosts = async () => {
    setIsLoading(true);
    setError(null);
    setPosts([]);

    const subs = subreddits.split(',').map(s => s.trim()).filter(s => s !== '');

    if (subs.every(isValidSubreddit)) {
      try {
        const allPosts = await Promise.all(
          subs.map(async sub => {
            return await getHotPosts(sub);
          })
        );
        // Flatten the array of arrays into a single array
        const flattenedPosts = allPosts.reduce((acc, curr) => acc.concat(curr), []);

        // Basic media filtering, adapt as necessary
        const mediaPosts = flattenedPosts.filter(post => {
            return post.mediaUrl.endsWith('.jpg') || post.mediaUrl.endsWith('.jpeg') || post.mediaUrl.endsWith('.png') || post.mediaUrl.endsWith('.mp4');
        });
        setPosts(mediaPosts);
      } catch (e: any) {
        setError(`Failed to fetch posts: ${e.message}`);
      }
    } else {
      setError("Invalid subreddit name. Please use only alphanumeric characters and underscores.");
    }
    setIsLoading(false);
  };

  const handleThumbnailClick = (post: RedditPost) => {
    setSelectedPost(post);
  };

  const handleDialogClose = () => {
    setSelectedPost(null);
  };


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Sub Gallery</h1>

      {/* Subreddit Input */}
      <div className="flex flex-col mb-4">
        <Input
          type="text"
          placeholder="Enter subreddit names separated by commas (e.g., pics, videos)"
          value={subreddits}
          onChange={(e) => setSubreddits(e.target.value)}
        />
        <Button onClick={fetchPosts} disabled={isLoading} className="mt-2 w-fit">
          {isLoading ? "Fetching..." : "Fetch Posts"}
        </Button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>

      {/* Media Gallery */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {posts.map((post, index) => (
            <div key={index} className="relative">
              <button onClick={() => handleThumbnailClick(post)} className="w-full h-full block">
                <Card className="overflow-hidden cursor-pointer">
                  {post.mediaUrl.endsWith('.mp4') ? (
                      <video src={post.mediaUrl} alt={post.title} className="w-full h-auto object-cover aspect-square" muted playsInline />
                  ) : (
                      <img src={post.mediaUrl} alt={post.title} className="w-full h-auto object-cover aspect-square" />
                  )}
                </Card>
              </button>
            </div>
        ))}
      </div>

      {/* Expanded View Modal */}
      <Dialog open={selectedPost !== null} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
        <DialogContent className="max-w-lg">
          {selectedPost && (
            <>
              <DialogTitle>{selectedPost.title}</DialogTitle>
              <DialogDescription>From: {selectedPost.subreddit}</DialogDescription>
              {selectedPost.mediaUrl.endsWith('.mp4') ? (
                <video src={selectedPost.mediaUrl} alt={selectedPost.title} className="w-full h-auto" controls playsInline />
              ) : (
                <img src={selectedPost.mediaUrl} alt={selectedPost.title} className="w-full h-auto" />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Footer */}
      <footer className="mt-8 text-center text-muted-foreground">
        <p>
          Built with ❤️ by Firebase Studio
        </p>
      </footer>
    </div>
  );
}
