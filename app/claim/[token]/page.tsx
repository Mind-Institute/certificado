import { redirect } from "next/navigation";

interface PageProps {
  params: { token: string };
}

export default function ClaimPage({ params }: PageProps) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "https://iclpvamfvffsqptbmlfv.supabase.co";
  const target = `${supabaseUrl}/functions/v1/claim-certificate?token=${encodeURIComponent(params.token)}`;
  redirect(target);
}
