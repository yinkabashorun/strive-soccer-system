/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Private course sites are read from disk at request time (lib/elite/
  // private-sites.ts); tell the tracer to ship them with the route.
  experimental: {
    outputFileTracingIncludes: {
      "/learn/[slug]/[[...path]]": ["./content/courses/**/*.html"],
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

module.exports = nextConfig;
