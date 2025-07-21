import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subreddit = searchParams.get('subreddit');
  const sortType = searchParams.get('sortType');
  const timeFrame = searchParams.get('timeFrame');
  const after = searchParams.get('after');
  const limit = searchParams.get('limit');

  if (!subreddit || !sortType) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  let url = `https://www.reddit.com/r/${subreddit}/${sortType}.json?limit=${limit || 20}&raw_json=1`;
  if (sortType === 'top' && timeFrame) {
    url += `&t=${timeFrame}`;
  }
  if (after) {
    url += `&after=${after}`;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Redditgram/1.0',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: 'Failed to fetch from Reddit API', details: errorData }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
