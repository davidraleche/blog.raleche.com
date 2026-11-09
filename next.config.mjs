/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  async redirects() {
    return [{ source: "/executive-summaries", destination: "/memos", permanent: true }];
  },
};
export default nextConfig;
