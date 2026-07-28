import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.xingren.me",
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;
