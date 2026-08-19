import { supabase } from "@/integrations/supabase/client";

export async function getReceiptSignedUrl(
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 60 * 60);

  if (error) {
    console.error("Could not create receipt URL:", error);
    return null;
  }

  return data?.signedUrl ?? null;
}
