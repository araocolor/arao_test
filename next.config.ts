import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  allowedDevOrigins: ["172.30.1.33"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mubfvpwohdyqjsqjiozq.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
