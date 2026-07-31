/** @type {import('next').NextConfig} */
const nextConfig = {
  // El repo tiene otro package-lock.json en el directorio padre (proyecto
  // aparte). Sin esto, Next.js infiere mal la raíz del workspace y calcula
  // mal qué archivos empaqueta cada función serverless.
  outputFileTracingRoot: import.meta.dirname,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
