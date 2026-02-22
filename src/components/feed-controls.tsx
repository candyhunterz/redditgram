'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filter, Search, X, Grid3X3, LayoutGrid, Grid2X2, Heart } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { SortType, TimeFrame } from '@/types/reddit';
import type { GridDensity } from '@/hooks/use-grid-density';

interface FeedControlsProps {
  sortType: SortType;
  setSortType: (value: SortType) => void;
  timeFrame: TimeFrame;
  setTimeFrame: (value: TimeFrame) => void;
  isLoading: boolean;
  // Post search
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  clearSearch: () => void;
  filteredPostCount: number;
  showSearch: boolean;
  // Grid density
  density: GridDensity;
  cycleDensity: () => void;
  densityLabel: string;
  // Favorites
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (fn: (prev: boolean) => boolean) => void;
  favoritesCount: number;
}

export function FeedControls({
  sortType,
  setSortType,
  timeFrame,
  setTimeFrame,
  isLoading,
  searchQuery,
  setSearchQuery,
  clearSearch,
  filteredPostCount,
  showSearch,
  density,
  cycleDensity,
  densityLabel,
  showFavoritesOnly,
  setShowFavoritesOnly,
  favoritesCount,
}: FeedControlsProps) {
  const [isControlsOpen, setIsControlsOpen] = useState(false);

  return (
    <Collapsible open={isControlsOpen} onOpenChange={setIsControlsOpen}>
      <div className="flex justify-center mb-2">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
          >
            <Filter className="h-4 w-4 mr-1" />
            {isControlsOpen ? 'Hide Options' : 'Show Options'}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-3 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        {/* Sort/Timeframe Controls */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-center pt-2">
          <RadioGroup
            defaultValue="hot"
            className="flex gap-4"
            value={sortType}
            onValueChange={(value) => {
              if (!isLoading) setSortType(value as SortType);
            }}
            aria-label="Sort posts by"
          >
            <Label
              htmlFor="sort-hot"
              className={cn(
                'flex items-center space-x-2 p-1 rounded',
                isLoading
                  ? 'text-muted-foreground cursor-not-allowed'
                  : 'cursor-pointer hover:bg-accent'
              )}
            >
              <RadioGroupItem value="hot" id="sort-hot" disabled={isLoading} />
              <span>Hot</span>
            </Label>
            <Label
              htmlFor="sort-top"
              className={cn(
                'flex items-center space-x-2 p-1 rounded',
                isLoading
                  ? 'text-muted-foreground cursor-not-allowed'
                  : 'cursor-pointer hover:bg-accent'
              )}
            >
              <RadioGroupItem value="top" id="sort-top" disabled={isLoading} />
              <span>Top</span>
            </Label>
          </RadioGroup>
          {sortType === 'top' && (
            <Select
              value={timeFrame}
              onValueChange={(value) => {
                if (!isLoading) setTimeFrame(value as TimeFrame);
              }}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[180px]" aria-label="Time frame">
                <SelectValue placeholder="Time frame" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Search Posts */}
        {showSearch && (
          <div className="relative pt-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search loaded posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-sm"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                    onClick={clearSearch}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mt-1">
                Found {filteredPostCount} matching posts
              </p>
            )}
          </div>
        )}

        {/* Grid Density and Favorites Toggles */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-sm active:scale-95 transition-transform"
            onClick={cycleDensity}
            title={`Grid: ${densityLabel}`}
          >
            {density === 'compact' ? (
              <Grid3X3 className="h-4 w-4 mr-2" />
            ) : density === 'comfortable' ? (
              <LayoutGrid className="h-4 w-4 mr-2" />
            ) : (
              <Grid2X2 className="h-4 w-4 mr-2" />
            )}
            {densityLabel}
          </Button>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'text-sm active:scale-95 transition-transform',
              showFavoritesOnly && 'bg-pink-600 hover:bg-pink-700'
            )}
            onClick={() => setShowFavoritesOnly((prev) => !prev)}
            disabled={isLoading || favoritesCount === 0}
          >
            <Heart
              className={cn('h-4 w-4 mr-2', showFavoritesOnly && 'fill-current')}
            />
            {showFavoritesOnly ? 'Showing' : 'Show'} Favorites ({favoritesCount})
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
