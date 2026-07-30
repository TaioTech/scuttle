import Game from "@/components/Game";

/**
 * Which build this is.
 *
 * Read at module scope rather than inside the component: it is inlined at build
 * time, so it is a constant and not something the render has to look up.
 */
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
        <span className="font-mono opacity-60" title="build">
          {BUILD}
        </span>
      </footer>
    </main>
  );
}
