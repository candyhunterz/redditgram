import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProgressiveVideo } from './progressive-image';

it('recovers from an unavailable high-quality video using the original fallback', () => {
  const { container } = render(<ProgressiveVideo src="https://v.redd.it/id/high.mp4" fallbackSrc="https://v.redd.it/id/low.mp4" />);
  const video = container.querySelector('video')!;
  fireEvent.error(video);
  expect(video).toHaveAttribute('src', 'https://v.redd.it/id/low.mp4');
  expect(screen.queryByText('Failed to load video')).not.toBeInTheDocument();
  fireEvent.error(video);
  expect(screen.getByText('Failed to load video')).toBeInTheDocument();
});


const mockHandlers: Record<string, (...args: any[]) => void> = {};
const mockPlayer = {
  initialize: jest.fn(), updateSettings: jest.fn(), reset: jest.fn(),
  on: jest.fn((event, handler) => { mockHandlers[event] = handler; }),
  getRepresentationsByType: jest.fn(() => [
    { id: 'low', height: 480, bitrateInKbit: 500 },
    { id: 'high', height: 1080, bitrateInKbit: 3000 },
  ]),
  setRepresentationForTypeById: jest.fn(),
};
jest.mock('dashjs', () => ({ MediaPlayer: Object.assign(() => ({ create: () => mockPlayer }), {
  events: { STREAM_INITIALIZED: 'ready', ERROR: 'error' }, errors: { TIME_SYNC_FAILED_ERROR_CODE: 16 },
}) }));

it('loads the complete audio/video manifest, selects high quality, and releases playback on close', async () => {
  jest.clearAllMocks();
  const { container, unmount } = render(<ProgressiveVideo src="https://v.redd.it/id/video.mp4"
    manifestUrl="https://v.redd.it/id/DASHPlaylist.mpd" muted={false} autoPlay={false} controls />);
  await waitFor(() => expect(mockPlayer.initialize).toHaveBeenCalled());
  expect(mockPlayer.initialize).toHaveBeenCalledWith(container.querySelector('video'), 'https://v.redd.it/id/DASHPlaylist.mpd', false);
  expect(container.querySelector('video')?.muted).toBe(false);
  act(() => mockHandlers.ready());
  expect(mockPlayer.setRepresentationForTypeById).toHaveBeenCalledWith('video', 'high', true);
  unmount();
  expect(mockPlayer.reset).toHaveBeenCalledTimes(1);
});

it('uses a fresh video element for MP4 fallback after a stream failure', async () => {
  jest.clearAllMocks();
  const src = 'https://v.redd.it/id/video.mp4';
  const { container } = render(<ProgressiveVideo src={src} manifestUrl="https://v.redd.it/id/DASHPlaylist.mpd" />);
  await waitFor(() => expect(mockPlayer.initialize).toHaveBeenCalled());
  const original = container.querySelector('video');
  act(() => mockHandlers.error({ error: { code: 16 } }));
  expect(container.querySelector('video')).toBe(original);
  act(() => mockHandlers.error({ error: { code: 11 } }));
  expect(container.querySelector('video')).not.toBe(original);
  expect(container.querySelector('video')).toHaveAttribute('src', src);
  expect(mockPlayer.reset).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Streaming unavailable/)).toBeInTheDocument();
});
