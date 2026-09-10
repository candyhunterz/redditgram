import { act, renderHook } from '@testing-library/react';
import { useFullscreenDialog } from './use-fullscreen-dialog';

it('does not clear a newly opened post when the previous close timer expires', () => {
  jest.useFakeTimers();
  const post = { postId: 'id', title: 'Post', subreddit: 'pics', mediaUrls: [], fullQualityUrls: [] };
  const { result, unmount } = renderHook(() => useFullscreenDialog());
  act(() => result.current.openDialog(post));
  act(() => result.current.closeDialog());
  act(() => result.current.openDialog({ ...post, postId: 'new' }));
  act(() => jest.advanceTimersByTime(300));
  expect(result.current.selectedPost?.postId).toBe('new');
  expect(result.current.isDialogOpen).toBe(true);
  unmount();
  jest.useRealTimers();
});
