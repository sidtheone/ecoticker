import TopicGrid from "@/components/TopicGrid";
import BiggestMovers from "@/components/BiggestMovers";

export default function Home() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">EcoTicker</h1>
        <p className="text-sm sm:text-base text-gray-400 mt-1">Environmental news impact tracker</p>
      </div>
      <div className="mb-8">
        <BiggestMovers />
      </div>
      <TopicGrid />
    </div>
  );
}
