import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/panel", "/acceder", "/diagnostico", "/api/"],
    },
    host: "https://jota-agency.vercel.app",
  };
}
