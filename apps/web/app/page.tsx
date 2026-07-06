import { HomeClient } from "./HomeClient";

interface PageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const { email } = await searchParams;
  return <HomeClient initialEmail={email ?? ""} />;
}
