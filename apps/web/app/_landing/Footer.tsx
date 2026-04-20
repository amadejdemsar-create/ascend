export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center">
        <span className="font-serif text-lg font-semibold text-white">
          Ascend
        </span>
        <p className="max-w-md text-sm text-zinc-500">
          Goal tracking that connects daily actions to yearly ambitions.
        </p>
        <p className="text-xs text-zinc-600">
          &copy; {year} Ascend. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
