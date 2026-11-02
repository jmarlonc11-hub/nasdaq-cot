import { revalidatePath } from "next/cache";

// Lo invoca el cron de Vercel (vercel.json) para traer el último COT apenas lo publica la CFTC.
// Vercel envía `Authorization: Bearer $CRON_SECRET` si CRON_SECRET está definido.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  revalidatePath("/");
  revalidatePath("/api/cot");
  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
