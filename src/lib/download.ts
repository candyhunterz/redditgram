/**
 * Generate a filename for downloaded media
 */
export function generateFilename(subreddit: string, postId: string, url: string): string {
  const extension = getExtensionFromUrl(url)
  return `reddit_${subreddit}_${postId}.${extension}`
}

/**
 * Extract file extension from URL
 */
function getExtensionFromUrl(url: string): string {
  const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'mp4']
  const lowerUrl = url.toLowerCase()

  for (const ext of validExtensions) {
    if (lowerUrl.endsWith(`.${ext}`)) {
      return ext
    }
  }

  return 'jpg' // Default to jpg
}

interface DownloadMediaParams {
  url: string
  subreddit: string
  postId: string
}

/**
 * Download media file from URL
 */
export async function downloadMedia(params: DownloadMediaParams): Promise<boolean> {
  const { url, subreddit, postId } = params

  try {
    const response = await fetch(url)

    if (!response.ok) {
      return false
    }

    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    const filename = generateFilename(subreddit, postId, url)

    // Create temporary link and trigger download
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    link.style.display = 'none'
    link.click()

    // Clean up
    URL.revokeObjectURL(blobUrl)

    return true
  } catch {
    return false
  }
}
