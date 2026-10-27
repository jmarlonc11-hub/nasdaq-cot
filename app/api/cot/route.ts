import { getCotPayload } from "@/lib/cftc";

export const revalidate = 3600;

export async function GET() {
  return Response.json(await getCotPayload());
}
