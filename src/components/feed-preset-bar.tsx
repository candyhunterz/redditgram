"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FeedPreset } from '@/lib/indexed-db';

interface FeedPresetBarProps {
  presets: FeedPreset[];
  activePresetName: string | null;
  onLoadPreset: (preset: FeedPreset) => void;
  onSavePreset: () => void;
  onUpdatePreset: (presetName: string) => void;
  onDeletePreset: (presetName: string) => void;
  onRenamePreset: (oldName: string) => void;
  disabled?: boolean;
}

export const FeedPresetBar: React.FC<FeedPresetBarProps> = ({
  presets,
  activePresetName,
  onLoadPreset,
  onSavePreset,
  onUpdatePreset,
  onDeletePreset,
  onRenamePreset,
  disabled = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (presets.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">No presets saved</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onSavePreset}
          disabled={disabled}
        >
          <Plus className="h-3 w-3 mr-1" />
          Save Preset
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {presets.map((preset) => {
          const isActive = activePresetName === preset.name;
          return (
            <DropdownMenu key={preset.name}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 px-3 text-xs whitespace-nowrap flex-shrink-0 active:scale-95 transition-transform",
                    isActive && "ring-2 ring-primary/30"
                  )}
                  onClick={(e) => {
                    // Left click loads the preset
                    e.preventDefault();
                    if (!disabled) onLoadPreset(preset);
                  }}
                  onContextMenu={(e) => {
                    // Right-click opens context menu (handled by DropdownMenu)
                  }}
                  disabled={disabled}
                >
                  {preset.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem onClick={() => onLoadPreset(preset)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  Load
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdatePreset(preset.name)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Update
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRenamePreset(preset.name)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDeletePreset(preset.name)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-7 p-0 flex-shrink-0 active:scale-95 transition-transform"
        onClick={onSavePreset}
        disabled={disabled}
        title="Save current feed as preset"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
