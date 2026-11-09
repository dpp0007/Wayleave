import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// The API is not for crawlers: every route is POST-only and spends paid credits.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }], sitemap: `${SITE}/sitemap.xml` };
}
