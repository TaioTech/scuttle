import Game from "@/components/Game";

/**
 * Which build this is.
 *
 * Read at module scope rather than inside the component: it is inlined at build
 * time, so it is a constant and not something the render has to look up.
 *
 * Two values rather than one, because they answer different questions. The
 * version says which release you are on and is the one a person can actually
 * hold in their head. The commit says which build — and a version that only
 * moves when something is released cannot tell two builds of the same version
 * apart, which is the exact question the stamp was added to answer.
 */
const VERSION = process.env.NEXT_PUBLIC_VERSION ?? "0.0.0";
const BUILD = process.env.NEXT_PUBLIC_BUILD ?? "dev";

export default function Page() {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <Game />
      <footer className="flex items-baseline justify-between border-t border-line px-4 py-3 text-xs text-muted">
        <a
          href="https://taiotech.com"
          className="transition-colors hover:text-foreground"
        >
          taiotech.com
        </a>
        {/* Dim on purpose. It is proof rather than information: findable the
            moment somebody needs to know which build they are looking at, and
            invisible the rest of the time. */}
        <span className="font-mono opacity-60" title={`version ${VERSION}, build ${BUILD}`}>
          v{VERSION} <span className="opacity-70">· {BUILD}</span>
        </span>
      </footer>
    </main>
  );
}
