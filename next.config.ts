import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  output: "standalone",
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

export default withWorkflow(nextConfig);
