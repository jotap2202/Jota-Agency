import type { MetadataRoute } from "next";
import { SITIO_URL } from "@/lib/sitio";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/panel", "/acceder", "/diagnostico", "/api/"],
    },
    host: SITIO_URL,
  };
}
