/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mind-institute.github.io",
      },
    ],
  },
};

export default nextConfig;
