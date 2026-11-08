import { revalidatePath } from "next/cache";
import { handleRevalidatePaths } from "@/lib/revalidate-paths";

/** Drops cached /p HTML. Loopback host plus the runtime revalidate token. */
export async function POST(request: Request) {
  return handleRevalidatePaths(request, revalidatePath);
}

export const dynamic = "force-dynamic";
