import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Home from './page';

const mockFetch = jest.fn();
const mockPost = { postId: 'id', title: 'Cat photo', subreddit: 'pics', mediaUrls: [], fullQualityUrls: [] };
jest.mock('@/hooks/use-reddit-posts', () => ({ useRedditPosts: () => ({
  posts: [mockPost], error: null, isLoading: false, hasMore: false, fetchInitiated: true,
  fetchInitialPosts: mockFetch, lastPostRef: jest.fn(),
}) }));
jest.mock('@/hooks/use-favorites', () => ({ useFavorites: () => ({
  favorites: {}, showFavoritesOnly: false, setShowFavoritesOnly: jest.fn(), toggleFavorite: jest.fn(),
}) }));
jest.mock('@/hooks/use-feed-presets', () => ({ useFeedPresets: () => ({
  presets: [], activePresetName: null, handleLoadPreset: jest.fn(),
}) }));
jest.mock('@/components/feed-preset-bar', () => ({ FeedPresetBar: ({ onLoadPreset }: any) =>
  <button onClick={() => onLoadPreset({ name: 'Annual', subreddits: 'aww', sortType: 'top', timeFrame: 'year' })}>Load annual preset</button>,
}));
jest.mock('@/components/post-grid', () => ({ PostGrid: ({ posts, showMetadata }: any) =>
  <div data-testid="grid" data-metadata={showMetadata}>{posts.map((p: any) => p.title).join(',')}</div>,
}));
jest.mock('@/components/fullscreen-dialog', () => ({
  FullscreenDialog: ({ autoplayVideos, keyboardShortcutsEnabled }: any) =>
    <div data-testid="fullscreen-settings" data-autoplay={autoplayVideos} data-shortcuts={keyboardShortcutsEnabled} />,
  KeyboardShortcutsDialog: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  (localStorage.getItem as jest.Mock).mockReturnValue(null);
});

it('passes saved filters into the same fetch that loads a preset', () => {
  render(<Home />);
  fireEvent.click(screen.getByText('Load annual preset'));
  expect(mockFetch).toHaveBeenCalledWith('aww', { sortType: 'top', timeFrame: 'year' });
});

it('keeps the search editable when there are zero matches', () => {
  render(<Home />);
  fireEvent.click(screen.getByRole('button', { name: 'Show Options' }));
  fireEvent.change(screen.getByPlaceholderText('Search loaded posts...'), { target: { value: 'no matches' } });
  expect(screen.getByPlaceholderText('Search loaded posts...')).toHaveValue('no matches');
  expect(screen.getByTestId('grid')).toBeEmptyDOMElement();
  fireEvent.change(screen.getByPlaceholderText('Search loaded posts...'), { target: { value: '' } });
  expect(screen.getByTestId('grid')).toHaveTextContent('Cat photo');
});

it('shares density and theme state between toolbar and settings and wires behavior toggles', () => {
  render(<Home />);
  fireEvent.click(screen.getByRole('button', { name: 'Show Options' }));
  fireEvent.click(screen.getByRole('button', { name: 'Comfortable' }));
  expect(screen.getByRole('button', { name: 'Spacious' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  expect(screen.getByRole('radio', { name: 'Spacious' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('radio', { name: 'Compact' }));
  expect(screen.getByRole('button', { name: 'Compact' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  expect(document.documentElement).toHaveClass('dark');
  fireEvent.click(screen.getByRole('switch', { name: 'Autoplay videos' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Enable keyboard shortcuts' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Show post metadata on hover' }));
  expect(screen.getByTestId('grid')).toHaveAttribute('data-metadata', 'false');
  expect(screen.getByTestId('fullscreen-settings')).toHaveAttribute('data-autoplay', 'false');
  expect(screen.getByTestId('fullscreen-settings')).toHaveAttribute('data-shortcuts', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Enter subreddit names separated by commas' }), { key: 'Enter' });
  expect(mockFetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
  expect(document.documentElement).toHaveClass('light');
});
