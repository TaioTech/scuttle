import Game from "@/components/Game";

export default function Page() {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <Game />
      <footer className="border-t border-line px-4 py-3 text-center text-xs text-muted">
        <a
          href="https://taiotech.com"
          className="transition-colors hover:text-foreground"
        >
          taiotech.com
        </a>
      </footer>
    </main>
  );
}
