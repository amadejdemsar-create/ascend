export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center">
      <h1 className="text-6xl font-bold tracking-tight text-white">Ascend</h1>
      <p className="mt-4 text-lg text-gray-400">
        Goal tracking, deployed.
      </p>
      <p className="mt-8 text-sm text-gray-600">
        {new Date().getFullYear()}
      </p>
    </main>
  );
}
