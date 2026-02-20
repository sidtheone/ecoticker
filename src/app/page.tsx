import TopicGrid from "@/components/TopicGrid";
import BiggestMovers from "@/components/BiggestMovers";
import InsightHeadline from "@/components/InsightHeadline";

export default function Home() {
  return (
    <div>
      <div className="mb-8">
        <InsightHeadline />
      </div>
      <div className="mb-8">
        <BiggestMovers />
      </div>
      <TopicGrid />
    </div>
  );
}
