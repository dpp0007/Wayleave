import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wayleave", short_name: "Wayleave", description: "Where is it easiest to start? Compare licences, fees and approval times across places.",
    start_url: "/", display: "standalone", background_color: "#f6f6fa", theme_color: "#5b5bd6",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
