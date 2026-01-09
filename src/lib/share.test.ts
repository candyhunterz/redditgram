import { sharePost, copyToClipboard, getRedditUrl } from './share'

// Mock navigator.share
const mockShare = jest.fn()
const mockWriteText = jest.fn()

describe('share utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset navigator mocks
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    })
  })

  describe('getRedditUrl', () => {
    it('should generate correct Reddit URL', () => {
      const url = getRedditUrl('funny', 'abc123')
      expect(url).toBe('https://www.reddit.com/r/funny/comments/abc123')
    })
  })

  describe('copyToClipboard', () => {
    it('should copy text to clipboard', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)

      const result = await copyToClipboard('test text')

      expect(mockWriteText).toHaveBeenCalledWith('test text')
      expect(result).toBe(true)
    })

    it('should return false on clipboard error', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard error'))

      const result = await copyToClipboard('test text')

      expect(result).toBe(false)
    })
  })

  describe('sharePost', () => {
    it('should use Web Share API when available', async () => {
      Object.defineProperty(navigator, 'share', {
        value: mockShare.mockResolvedValueOnce(undefined),
        writable: true,
        configurable: true,
      })

      const result = await sharePost({
        title: 'Test Post',
        subreddit: 'funny',
        postId: 'abc123',
      })

      expect(mockShare).toHaveBeenCalledWith({
        title: 'Test Post',
        text: 'Check out this post from r/funny',
        url: 'https://www.reddit.com/r/funny/comments/abc123',
      })
      expect(result).toEqual({ shared: true, method: 'share' })
    })

    it('should fallback to clipboard when Web Share API is not available', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)

      const result = await sharePost({
        title: 'Test Post',
        subreddit: 'funny',
        postId: 'abc123',
      })

      expect(mockWriteText).toHaveBeenCalledWith(
        'https://www.reddit.com/r/funny/comments/abc123'
      )
      expect(result).toEqual({ shared: true, method: 'clipboard' })
    })

    it('should fallback to clipboard when Web Share API fails', async () => {
      Object.defineProperty(navigator, 'share', {
        value: mockShare.mockRejectedValueOnce(new Error('Share failed')),
        writable: true,
        configurable: true,
      })
      mockWriteText.mockResolvedValueOnce(undefined)

      const result = await sharePost({
        title: 'Test Post',
        subreddit: 'funny',
        postId: 'abc123',
      })

      expect(mockWriteText).toHaveBeenCalled()
      expect(result).toEqual({ shared: true, method: 'clipboard' })
    })

    it('should return shared: false when both methods fail', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard error'))

      const result = await sharePost({
        title: 'Test Post',
        subreddit: 'funny',
        postId: 'abc123',
      })

      expect(result).toEqual({ shared: false, method: null })
    })
  })
})
