import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/runelite/static.runelite.net/gh-pages/cache/item/icon/**",
      },
    ],
  },
};

export default nextConfig;
