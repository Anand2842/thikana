export default function PropertiesLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10" aria-busy="true" aria-label="Loading homes">
      <div className="eyebrow">AVAILABLE HOMES · VERIFIED BROKERS</div>
      <div className="display font-black text-4xl mt-1 h-10 w-72 bg-line/60 rounded-xl" />
      <div className="bg-cream border border-line rounded-3xl p-5 mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-line/50 rounded-xl" />
        ))}
      </div>
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-cream border border-line rounded-3xl overflow-hidden">
            <div className="w-full h-52 bg-line/50" />
            <div className="p-5 space-y-2">
              <div className="h-5 w-3/4 bg-line/60 rounded-lg" />
              <div className="h-4 w-1/2 bg-line/50 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
