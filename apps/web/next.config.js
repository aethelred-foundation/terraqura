const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@terraqura/types"],

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.aethelred.io" },
      { protocol: "https", hostname: "terraqura.aethelred.network" },
      { protocol: "https", hostname: "*.aethelred.network" },
      { protocol: "http", hostname: "localhost" },
    ],
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Performance optimizations
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  trailingSlash: false,
  generateEtags: true,

  // Experimental features for performance
  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
    ],
  },

  // Turbopack configuration (default bundler in Next.js 16)
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },

  // TypeScript
  typescript: {
    ignoreBuildErrors: false,
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/image/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { isServer, dev }) => {
    // Resolve fallbacks
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        buffer: false,
        path: false,
        os: false,
      };
    }

    // Aliases
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-native-async-storage/async-storage": false,
      "react-native": false,
    };

    // Externals
    if (!isServer) {
      const externals = Array.isArray(config.externals)
        ? config.externals
        : [];
      externals.push("pino-pretty", "lokijs", "encoding");
      config.externals = externals;
    }

    // Tree shaking for GSAP
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/gsap/,
      sideEffects: false,
    });

    // Production optimizations
    if (!dev && !isServer) {
      config.optimization.minimize = true;
    }

    return config;
  },

  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },
};

module.exports = nextConfig;
