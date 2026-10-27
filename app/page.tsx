import Terminal from "@/components/Terminal";
import { getCotPayload } from "@/lib/cftc";

export const revalidate = 3600;

export default async function Page() {
  const data = await getCotPayload();
  return <Terminal data={data} />;
}
