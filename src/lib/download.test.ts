import { generateFilename, downloadMedia } from './download'

// Mock fetch and URL APIs
const mockFetch = jest.fn()
const mockCreateObjectURL = jest.fn()
const mockRevokeObjectURL = jest.fn()
const mockClick = jest.fn()
const mockAppendChild = jest.fn()
const mockRemoveChild = jest.fn()

describe('download utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch
    Object.defineProperty(URL, 'createObjectURL', { value: mockCreateObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: mockRevokeObjectURL, configurable: true })

    // Mock document.body methods
    jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild)
    jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild)

    // Mock document.createElement
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: mockClick,
          style: {},
        } as unknown as HTMLAnchorElement
      }
      return document.createElement(tag)
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('generateFilename', () => {
    it('should generate filename with correct extension for images', () => {
      expect(generateFilename('funny', 'abc123', 'https://i.redd.it/image.jpg')).toBe('reddit_funny_abc123.jpg')
      expect(generateFilename('pics', 'def456', 'https://i.redd.it/image.png')).toBe('reddit_pics_def456.png')
      expect(generateFilename('art', 'ghi789', 'https://i.redd.it/image.gif')).toBe('reddit_art_ghi789.gif')
      expect(generateFilename('videos', 'jkl012', 'https://v.redd.it/video.mp4')).toBe('reddit_videos_jkl012.mp4')
    })

    it('should default to jpg for unknown extensions', () => {
      expect(generateFilename('test', 'abc', 'https://example.com/image')).toBe('reddit_test_abc.jpg')
      expect(generateFilename('test', 'abc', 'https://example.com/image.webp')).toBe('reddit_test_abc.jpg')
    })
  })

  describe('downloadMedia', () => {
    it('should download media successfully via proxy', async () => {
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      })
      mockCreateObjectURL.mockReturnValueOnce('blob:test-url')

      const result = await downloadMedia({
        url: 'https://i.redd.it/image.jpg',
        subreddit: 'funny',
        postId: 'abc123',
      })

      // Should use proxy route with encoded URL and filename
      const expectedProxyUrl = '/api/download?url=https%3A%2F%2Fi.redd.it%2Fimage.jpg&filename=reddit_funny_abc123.jpg'
      expect(mockFetch).toHaveBeenCalledWith(expectedProxyUrl)
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(mockClick).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url')
      expect(result).toBe(true)
    })

    it('should return false on fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await downloadMedia({
        url: 'https://i.redd.it/image.jpg',
        subreddit: 'funny',
        postId: 'abc123',
      })

      expect(result).toBe(false)
    })

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await downloadMedia({
        url: 'https://i.redd.it/image.jpg',
        subreddit: 'funny',
        postId: 'abc123',
      })

      expect(result).toBe(false)
    })
  })
})
