import type { VercelRequest, VercelResponse } from '@vercel/node';

// Which country the visitor is in, as told by Vercel's edge (no IP is read or stored). Used only by the site statistics.
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const c = req.headers['x-vercel-ip-country'];
  const country = (Array.isArray(c) ? c[0] : c) ?? '';
  res.status(200).json({ country: /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null });
}
