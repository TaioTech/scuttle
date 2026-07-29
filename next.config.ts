import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pinned because this project is currently staged inside the hub
    // repository, which has its own lockfile one directory up. Without this
    // the build picks that directory as the workspace root and warns about it.
    root: import.meta.dirname,
  },
};

export default nextConfig;
