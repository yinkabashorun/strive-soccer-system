import type { MetadataRoute } from "next";

// The web app manifest (served at /manifest.webmanifest, linked from every
// page by Next). With it, "Add to Home Screen" installs Strive Elite as a
// real app: its own icon, no browser bars, and, on an iPhone, the only
// place Apple offers push notifications. Without it the home-screen icon is
// a bookmark. tests/install.test.ts guards the shape and the icon files.
//
// start_url is the app's front door: signed in goes to the dashboard (or
// the coach side), signed out goes to sign-in. Never /demo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Strive Elite",
    short_name: "Strive Elite",
    description: "Your training week, your courses and your coach, in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
