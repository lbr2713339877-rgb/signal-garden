import { revalidatePath } from "next/cache";
import { handleRevalidatePaths } from "@/lib/revalidate-paths";

/** Drops cached /p HTML. Only the loopback daily job may call it. */
export async function POST(request: Request) {
  return handleRevalidatePaths(request, revalidatePath);
}

export const dynamic = "force-dynamic";
