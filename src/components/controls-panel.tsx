'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Filter, Heart, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortType, TimeFrame } from '@/services/reddit';

interface ControlsPanelProps {
  isControlsOpen: boolean;
  setIsControlsOpen: (open: boolean) => void;
  sortType: SortType;
  setSortType: (sortType: SortType) => void;
  timeFrame: TimeFrame;
  setTimeFrame: (timeFrame: TimeFrame) => void;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (show: boolean) => void;
  favoritesCount: number;
  savedLists: { [name: string]: string };
  selectedListName: string;
  setSelectedListName: (name: string) => void;
  subredditInput: string;
  isLoading: boolean;
  onSaveList: () => void;
  onLoadList: (listName: string) => void;
  onDeleteList: () => void;
}

/**
 * Controls panel for sorting, filtering, and managing subreddit lists
 */
export function ControlsPanel({
  isControlsOpen,
  setIsControlsOpen,
  sortType,
  setSortType,
  timeFrame,
  setTimeFrame,
  showFavoritesOnly,
  setShowFavoritesOnly,
  favoritesCount,
  savedLists,
  selectedListName,
  subredditInput,
  isLoading,
  onSaveList,
  onLoadList,
  onDeleteList,
}: ControlsPanelProps) {
  const savedListNames = Object.keys(savedLists);

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
            {isControlsOpen ? "Hide Options" : "Show Options"}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="space-y-3 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        {/* Save/Load/Delete List Controls */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-2">
          <Select
            value={selectedListName}
            onValueChange={onLoadList}
            disabled={isLoading}
          >
            <SelectTrigger className="flex-grow" aria-label="Load saved list">
              <SelectValue placeholder="Load saved list..." />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                Saved Lists
              </div>
              {savedListNames.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No lists saved
                </div>
              )}
              {savedListNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={onSaveList}
            variant="outline"
            size="icon"
            aria-label="Save current list"
            title="Save current list"
            className="active:scale-95 transition-transform"
            disabled={isLoading || !subredditInput.trim()}
          >
            <Save className="h-4 w-4" />
          </Button>

          <Button
            onClick={onDeleteList}
            variant="destructive"
            size="icon"
            aria-label="Delete selected list"
            title="Delete selected list"
            disabled={!selectedListName || isLoading}
            className="active:scale-95 transition-transform"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Sort/Timeframe Controls */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-center pt-2">
          <RadioGroup
            value={sortType}
            onValueChange={(value) => {
              if (!isLoading) setSortType(value as SortType);
            }}
            className="flex gap-4"
            aria-label="Sort posts by"
          >
            <Label
              htmlFor="sort-hot"
              className={cn(
                "flex items-center space-x-2 p-1 rounded",
                isLoading ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-accent"
              )}
            >
              <RadioGroupItem value="hot" id="sort-hot" disabled={isLoading} />
              <span>Hot</span>
            </Label>
            <Label
              htmlFor="sort-top"
              className={cn(
                "flex items-center space-x-2 p-1 rounded",
                isLoading ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-accent"
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

        {/* Favorites Filter Toggle */}
        <div className="flex justify-center pt-2">
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            size="sm"
            className={cn(
              "text-sm active:scale-95 transition-transform",
              showFavoritesOnly && "bg-pink-600 hover:bg-pink-700"
            )}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            disabled={isLoading || favoritesCount === 0}
          >
            <Heart
              className={cn(
                "h-4 w-4 mr-2",
                showFavoritesOnly && "fill-current"
              )}
            />
            {showFavoritesOnly ? "Showing" : "Show"} Favorites ({favoritesCount})
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}