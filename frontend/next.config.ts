import type { NextConfig } from "next";

// NEXT_STATIC_EXPORT=1 builds a static site for GitHub Pages under
// /justiceupgrade-app/v2/ (used by .github/workflows/pages.yml). A normal
// `npm run build` / `npm run dev` is unchanged.
const staticExport = process.env.NEXT_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  ...(staticExport
    ? {
        output: "export",
        basePath: "/justiceupgrade-app/v2",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
