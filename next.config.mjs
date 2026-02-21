/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Image Optimizer is disabled for this scaffolded demo.
    // TODO: When deploying to production, configure specific remotePatterns
    // instead of using unoptimized, e.g.:
    // remotePatterns: [{ protocol: "https", hostname: "your-cdn.example.com" }]
    unoptimized: true,
  },
};

export default nextConfig;
