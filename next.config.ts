import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "rehovot-dogs-shaked.loca.lt",
    "*.loca.lt",
    "dining-provider-depth.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.ngrok-free.dev",
  ],
};

export default nextConfig;
