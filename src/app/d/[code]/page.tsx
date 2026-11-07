import { Suspense } from "react";
import { DayClient } from "./DayClient";

async function Day({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <DayClient code={code} />;
}

export default function DayPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense>
      <Day params={params} />
    </Suspense>
  );
}
