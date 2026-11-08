import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getClientConfig } from "@/config";
import { wallAllowed } from "@/lib/http";
import { WallClient } from "./WallClient";

export function generateMetadata(): Metadata {
  return { title: `${getClientConfig().appTitle} · Live Wall`, robots: { index: false, follow: false } };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Wall({ searchParams }: Props) {
  const { key } = await searchParams;
  const wallKey = typeof key === "string" ? key : null;
  // Off, or the wrong key: look exactly like a page that doesn't exist.
  if (!wallAllowed(wallKey)) notFound();
  return <WallClient wallKey={wallKey} />;
}

export default function WallPage(props: Props) {
  return (
    <Suspense>
      <Wall {...props} />
    </Suspense>
  );
}
