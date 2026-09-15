import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MediaCarousel } from './media-carousel';
import { PostCard } from './post-card';
import { Dialog } from './ui/dialog';
import { FullscreenDialog } from './fullscreen-dialog';
import { useFullscreenDialog } from '@/hooks/use-fullscreen-dialog';

jest.mock('./progressive-image', () => ({
  ProgressiveImage: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} />,
  ProgressiveVideo: ({ src, autoPlay }: { src: string; autoPlay: boolean }) => <video data-testid="video" src={src} autoPlay={autoPlay} />,
}));
const post = {
  title: 'Gallery', subreddit: 'pics', postId: 'id',
  mediaUrls: ['https://i.redd.it/a.jpg', 'https://i.redd.it/b.jpg'],
  fullQualityUrls: ['https://i.redd.it/a-full.jpg', 'https://i.redd.it/b-full.jpg'],
};

it('navigates the grid gallery without opening fullscreen, including keyboard activation', () => {
  const open = jest.fn();
  render(<PostCard post={post} isFavorite={false} onToggleFavorite={jest.fn()} onClick={open} gap={0} showMetadata={false} />);
  const next = screen.getByRole('button', { name: 'Next Media' });
  fireEvent.keyDown(next, { key: 'Enter' });
  fireEvent.click(next);
  expect(screen.getByRole('img')).toHaveAttribute('data-src', post.mediaUrls[1]);
  expect(open).not.toHaveBeenCalled();
});

it('downloads the currently displayed full-quality image', () => {
  const download = jest.fn();
  render(<Dialog><MediaCarousel {...post} isFullScreen onDownload={download} /></Dialog>);
  fireEvent.click(screen.getByRole('button', { name: 'Next Media' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download media' }));
  expect(download).toHaveBeenCalledWith(post.fullQualityUrls[1]);
});

it('honors the shortcut preference while keeping navigation buttons working', () => {
  const { rerender } = render(<Dialog><MediaCarousel {...post} isFullScreen keyboardShortcutsEnabled={false} /></Dialog>);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByRole('img')).toHaveAttribute('data-src', post.fullQualityUrls[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Next Media' }));
  expect(screen.getByRole('img')).toHaveAttribute('data-src', post.fullQualityUrls[1]);
  rerender(<Dialog><MediaCarousel {...post} isFullScreen keyboardShortcutsEnabled /></Dialog>);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByRole('img')).toHaveAttribute('data-src', post.fullQualityUrls[0]);
});

it('renders query-string MP4 URLs as video and honors autoplay settings', () => {
  const video = { ...post, mediaUrls: ['https://v.redd.it/id/video.mp4?source=fallback'], fullQualityUrls: [] };
  const { rerender } = render(<Dialog><MediaCarousel {...video} isFullScreen autoplayVideos={false} /></Dialog>);
  expect(screen.getByTestId('video')).not.toHaveAttribute('autoplay');
  rerender(<Dialog><MediaCarousel {...video} isFullScreen autoplayVideos /></Dialog>);
  expect(screen.getByTestId('video')).toHaveAttribute('autoplay');
});


it('opens the gallery image selected in the feed at full quality', () => {
  function Gallery() {
    const { selectedPost, selectedMediaIndex, isDialogOpen, openDialog, closeDialog } = useFullscreenDialog();
    return <>
      <PostCard post={post} isFavorite={false} onToggleFavorite={jest.fn()} onClick={openDialog} gap={0} showMetadata={false} />
      <FullscreenDialog isOpen={isDialogOpen} selectedPost={selectedPost} initialMediaIndex={selectedMediaIndex}
        onClose={closeDialog} favorites={{}} onToggleFavorite={jest.fn()} onShare={jest.fn()} onDownload={jest.fn()} />
    </>;
  }
  render(<Gallery />);
  fireEvent.click(screen.getByRole('button', { name: 'Next Media' }));
  fireEvent.click(screen.getByRole('img'));
  expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute('data-src', post.fullQualityUrls[1]);
});
