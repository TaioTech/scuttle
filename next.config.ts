import { execSync } from "node:child_process";
import type { NextConfig } from "next";

import { version } from "./package.json";

/**
 * The commit this bundle was built from, baked in at build time.
 *
 * It exists to answer one question that is otherwise surprisingly hard to
 * answer from a phone: is the thing I am looking at the thing that was just
 * built? A preview URL, a production domain and a dev server all look
 * identical, and "it still looks like the old version" is indistinguishable
 * from a stale cache, a protected preview, or an unmerged branch.
 *
 * Vercel supplies the SHA as an environment variable and there is no git
 * checkout in its build container, so that is tried first. Locally there is no
 * such variable but there is a repository, so `git` answers instead. If both
 * fail the build still succeeds with `dev` — a missing stamp must never be the
 * reason a deploy does not go out.
 */
function buildStamp(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);

  try {
    return execSync("git rev-parse --short=7 HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  env: {
    // NEXT_PUBLIC_ so it survives into the client bundle, which is where the
    // canvas and everything around it actually runs.
    NEXT_PUBLIC_BUILD: buildStamp(),
    // The released version, from `package.json` rather than from a git tag.
    // Tags are the wrong source here for a reason worth keeping: Vercel builds
    // from a tarball with no git checkout, so `git describe` has nothing to read
    // and would silently degrade to a fallback in exactly the environment the
    // number matters most. `package.json` is committed, so it is always there.
    // The release workflow keeps the two in step by bumping this file and
    // tagging the same commit.
    NEXT_PUBLIC_VERSION: version,
  },
};

export default nextConfig;
