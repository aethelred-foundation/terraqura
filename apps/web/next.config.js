const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@terraqura/network-manifest", "@terraqura/types"],

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

  // Turbopack configuration (default bundler in Next.js 16).
  // The `react-native` and `@react-native-async-storage/async-storage` shims
  // historically required by webpack are NOT needed under Turbopack because
  // the Web3 stack is dynamically imported on dapp routes only (see
  // src/app/providers.tsx) — nothing in the marketing bundle reaches RN code.
  turbopack: {
    root: path.resolve(__dirname, "../../"),
    resolveAlias: {
      "@react-native-async-storage/async-storage": "./src/lib/empty-module.ts",
      "react-native": "./src/lib/empty-module.ts",
    },
  },

  // TypeScript — build must fail on real errors
  typescript: {
    ignoreBuildErrors: false,
  },

  // Security headers
  async headers() {
    // Content Security Policy — covers the marketing site + Web3 dapp surfaces.
    // Shipped initially as Report-Only to validate against real traffic.
    // Flip the header key to "Content-Security-Policy" once confirmed clean.
    const cspDirectives = [
      "default-src 'self'",
      // 'unsafe-inline' for Next.js inlined RSC/runtime; Sumsub for KYC SDK; Vercel Analytics.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.sumsub.com https://*.vercel-scripts.com https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.aethelred.network https://*.walletconnect.com https://explorer-api.walletconnect.com",
      "font-src 'self' data:",
      // Wallet/RPC/WS endpoints + Vercel telemetry + Sumsub + WalletConnect relays
      "connect-src 'self' https://*.aethelred.network wss://*.aethelred.network https://*.walletconnect.org wss://*.walletconnect.org https://*.walletconnect.com wss://*.walletconnect.com https://api.web3modal.org https://pulse.walletconnect.org https://explorer-api.walletconnect.com https://*.blockvision.org https://*.alchemy.com https://*.infura.io https://api.aethelred.io https://api.sumsub.com wss://api.sumsub.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://*.vercel-insights.com",
      // Wallet redirect frames + Sumsub iframe
      "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org https://*.walletconnect.com https://api.sumsub.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Report-Only mode: violations are reported (to console) but the
          // browser does not block them. Flip to "Content-Security-Policy"
          // once validated against real traffic.
          { key: "Content-Security-Policy-Report-Only", value: cspDirectives },
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
