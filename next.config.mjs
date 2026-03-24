/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '80',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'oldclubman.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'test-api.oldclubman.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.oldclubman.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'd2zhr1p0n498z6.cloudfront.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'oldclub-production.s3.amazonaws.com',
        pathname: '/**',
      },

    ],
    // Fallback for older config
    domains: [
      'images.unsplash.com',
      'localhost',
      'oldclubman.com',
      'test-api.oldclubman.com',
      'api.oldclubman.com',
    ],
    // Allow unoptimized images as fallback
    unoptimized: false,
  },
  env: {
    NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
    NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2',
    NEXT_PUBLIC_PUSHER_HOST: process.env.NEXT_PUBLIC_PUSHER_HOST,
    NEXT_PUBLIC_PUSHER_PORT: process.env.NEXT_PUBLIC_PUSHER_PORT,
  },
};

export default nextConfig;
