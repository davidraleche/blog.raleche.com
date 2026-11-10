/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // Reads its geo database files from disk at run time, so it must not be bundled.
  serverExternalPackages: ["geoip-country"],
  async redirects() {
    return [{ source: "/executive-summaries", destination: "/memos", permanent: true },
      { source: "/account/summaries", destination: "/account", permanent: true }];
  },
};
export default nextConfig;
