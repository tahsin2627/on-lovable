import { NextRequest, NextResponse } from 'next/server';

function sanitize(text: string = ''): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u00AB\u00BB]/g, '"')
    .replace(/[\u2039\u203A]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u00A0]/g, ' ');
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'FIRECRAWL_API_KEY not set' },
        { status: 500 }
      );
    }

    console.log('[scrape-url-enhanced] Scraping:', url);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        timeout: 60000,          // 60 seconds
        waitFor: 5000,           // wait for JS render
        render_js: true,         // allow JS rendering
        blockAds: true,
        maxAge: 3600000          // 1 hour cache
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Firecrawl error]', errorText);
      return NextResponse.json(
        { success: false, error: 'Scrape failed', details: errorText },
        { status: 500 }
      );
    }

    const result = await response.json();

    if (!result?.success || !result?.data) {
      return NextResponse.json(
        { success: false, error: 'Invalid scrape response' },
        { status: 500 }
      );
    }

    const markdown = sanitize(result.data.markdown || '');
    const metadata = result.data.metadata || {};

    const formattedContent = `
Title: ${sanitize(metadata.title || '')}
Description: ${sanitize(metadata.description || '')}
URL: ${url}

Content:
${markdown}
    `.trim();

    return NextResponse.json({
      success: true,
      content: formattedContent,
      structured: {
        title: sanitize(metadata.title || ''),
        description: sanitize(metadata.description || ''),
        content: markdown,
        url,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        cached: result.data.cached || false,
        contentLength: formattedContent.length,
      },
    });

  } catch (error: any) {
    console.error('[scrape-url-enhanced] Fatal Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
