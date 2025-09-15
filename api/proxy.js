import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    res.send(buffer);
  } catch (error) {
    console.error('Error in proxy:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
