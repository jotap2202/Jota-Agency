/** @type {import('next').NextConfig} */
const nextConfig = {
  // El repo tiene otros package-lock.json en carpetas hermanas (jota-agency,
  // y el bot de trading en la raíz) — sin esto Next.js puede confundir cuál
  // es la raíz real del proyecto (mismo bug que se encontró y arregló en
  // jota-agency).
  outputFileTracingRoot: import.meta.dirname,
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
