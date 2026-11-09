// The site's public origin, for absolute URLs in metadata, the sitemap and robots.txt.
// Set NEXT_PUBLIC_SITE_URL for a custom domain; on Vercel the production domain is picked up automatically.
export const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
