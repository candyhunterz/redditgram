import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { PostGrid } from './post-grid';

const mockRenderMedia = jest.fn();
jest.mock('./media-carousel', () => ({ MediaCarousel: (props: { title: string }) => {
  mockRenderMedia(props);
  return <span data-testid="media">{props.title}</span>;
} }));
let notify: IntersectionObserverCallback;
let nodes: Element[];
beforeEach(() => {
  nodes = [];
  mockRenderMedia.mockClear();
  global.IntersectionObserver = jest.fn().mockImplementation(callback => {
    notify = callback;
    return { observe: (node: Element) => nodes.push(node), unobserve: jest.fn(), disconnect: jest.fn() };
  });
});
const props = {
  posts: Array.from({ length: 1000 }, (_, i) => ({
    postId: String(i), title: `Post ${i}`, subreddit: 'pics',
    mediaUrls: [`https://i.redd.it/${i}.jpg`], fullQualityUrls: [],
  })),
  isLoading: false, hasMore: false, fetchInitiated: true, showFavoritesOnly: false,
  error: null, favorites: {}, breakpointColumnsObj: { default: 1 }, gridStyle: {},
  densityGap: 8, showMetadata: true, lastPostRef: jest.fn(), onToggleFavorite: jest.fn(),
  onOpenDialog: jest.fn(), onRetry: jest.fn(), rawPostCount: 1000, onSubredditClick: jest.fn(),
};

it('bounds initial media mounts for 1000 posts and skips unchanged card renders', () => {
  const { rerender } = render(<PostGrid {...props} />);
  expect(screen.getAllByTestId('media')).toHaveLength(24);
  mockRenderMedia.mockClear();
  rerender(<PostGrid {...props} favorites={{ '0': { postId: '0', title: 'Post 0', subreddit: 'pics', thumbnailUrl: undefined } }} />);
  expect(mockRenderMedia).toHaveBeenCalledTimes(1);
});

it('replaces distant media with measured placeholders and restores it on return', () => {
  render(<PostGrid {...props} posts={props.posts.slice(0, 1)} />);
  const entry = { target: nodes[0], isIntersecting: false, boundingClientRect: { width: 200, height: 400 } } as IntersectionObserverEntry;
  act(() => notify([entry], {} as IntersectionObserver));
  expect(screen.queryByTestId('media')).not.toBeInTheDocument();
  expect(nodes[0]).toHaveStyle({ aspectRatio: '200 / 400' });
  act(() => notify([{ ...entry, isIntersecting: true }], {} as IntersectionObserver));
  expect(screen.getByTestId('media')).toHaveTextContent('Post 0');
});
