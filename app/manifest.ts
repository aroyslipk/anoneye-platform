import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anoneye — Public profile analytics",
    short_name: "Anoneye",
    description:
      "Discover public Instagram and Facebook profiles through official APIs and read honest, timestamped reports.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: "#4f46e5",
    lang: "bn",
    dir: "ltr",
    orientation: "portrait-primary",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
