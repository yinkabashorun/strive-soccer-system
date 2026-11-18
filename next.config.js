/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // The weekly card (app/api/elite/tracker/card) reads its two brand fonts
  // from disk; this ships them with that route on the server.
  experimental: {
    outputFileTracingIncludes: {
      "/api/elite/tracker/card": ["./lib/elite/fonts/*.ttf"],
    },
  },
  // The old $97 dribbling course sales page was retired Nov 18 2026. Any
  // old link or ad that still points at it lands on the Strive Elite page.
  async redirects() {
    return [
      { source: "/dribbling-course", destination: "/demo", permanent: true },
      { source: "/dribbling-course/:path*", destination: "/demo", permanent: true },
    ];
  },
};

module.exports = nextConfig;
