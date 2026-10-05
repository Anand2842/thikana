import Link from "next/link";
export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="display text-3xl font-black">
        This home is no longer here.
      </h1>
      <p className="mt-3">Browse the latest available homes.</p>
      <Link className="button inline-block mt-6" href="/properties">
        Find a home
      </Link>
    </main>
  );
}
