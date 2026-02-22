'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';
import { POPULAR_SUBREDDITS } from '@/hooks/use-subreddit-history';

interface SubredditSearchBarProps {
  subredditInput: string;
  setSubredditInput: (value: string) => void;
  isLoading: boolean;
  postsExist: boolean;
  onFetch: (inputOverride?: string) => void;
  getSuggestions: (query: string) => string[];
}

export function SubredditSearchBar({
  subredditInput,
  setSubredditInput,
  isLoading,
  postsExist,
  onFetch,
  getSuggestions,
}: SubredditSearchBarProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  return (
    <>
      {/* Input and Fetch Button */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        <div className="relative flex-grow">
          <Input
            type="text"
            aria-label="Enter subreddit names separated by commas"
            placeholder="Enter subreddits..."
            value={subredditInput}
            onChange={(e) => {
              const value = e.target.value;
              setSubredditInput(value);
              // Get the last word being typed for suggestions
              const parts = value.split(',');
              const lastPart = parts[parts.length - 1].trim();
              if (lastPart.length >= 2) {
                const matches = getSuggestions(lastPart);
                setSuggestions(matches.slice(0, 5));
                setShowSuggestions(matches.length > 0);
              } else {
                setShowSuggestions(false);
              }
            }}
            onFocus={() => {
              const parts = subredditInput.split(',');
              const lastPart = parts[parts.length - 1].trim();
              if (lastPart.length >= 2) {
                const matches = getSuggestions(lastPart);
                setSuggestions(matches.slice(0, 5));
                setShowSuggestions(matches.length > 0);
              }
            }}
            onBlur={() => {
              // Delay hiding to allow click on suggestion
              setTimeout(() => setShowSuggestions(false), 150);
            }}
            className="flex-grow text-base w-full"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) onFetch();
            }}
          />
          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    // Replace the last part with the suggestion
                    const parts = subredditInput.split(',');
                    parts[parts.length - 1] = ' ' + suggestion;
                    setSubredditInput(
                      parts.join(',').replace(/^,\s*/, '').trim()
                    );
                    setShowSuggestions(false);
                  }}
                >
                  r/{suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          onClick={() => onFetch()}
          disabled={isLoading}
          className="w-full sm:w-auto flex-shrink-0 active:scale-95 transition-transform"
        >
          {isLoading && !postsExist ? 'Fetching...' : 'Fetch'}
        </Button>
      </div>

      {/* Popular Subreddits */}
      <div className="flex flex-wrap justify-center gap-1.5">
        <span className="flex items-center text-xs text-muted-foreground mr-1">
          <TrendingUp className="h-3 w-3 mr-1" />
          Popular:
        </span>
        {POPULAR_SUBREDDITS.slice(0, 6).map((sub) => (
          <Button
            key={sub}
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs hover:bg-accent"
            onClick={() => {
              setSubredditInput(sub);
              setTimeout(() => onFetch(sub), 0);
            }}
          >
            r/{sub}
          </Button>
        ))}
      </div>
    </>
  );
}
