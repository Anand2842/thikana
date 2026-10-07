"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="display text-3xl font-black">
        We couldn’t load this page.
      </h1>
      <p className="mt-3">
        Please try again. Your saved records are still in your account.
      </p>
      <button onClick={reset} className="button mt-6">
        Try again
      </button>
    </div>
  );
}
