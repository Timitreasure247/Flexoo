import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Users, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { toast } from "sonner";

interface ReferralRow {
  id: string;
  referrer_profile_id: string;
  referee_user_id: string;
  referee_profile_id: string;
  reward_amount: number;
  status: string;
  created_at: string;
  referrer?: { full_name: string | null; username: string | null; referral_code: string | null };
  referee?: { full_name: string | null; username: string | null };
}

const AdminReferrals = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdminCheck();
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      setBusy(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      const referrerIds = Array.from(new Set((data ?? []).map((r) => r.referrer_profile_id)));
      const refereeIds = Array.from(new Set((data ?? []).map((r) => r.referee_profile_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, referral_code")
        .in("id", Array.from(new Set([...referrerIds, ...refereeIds])));
      const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      setRows(
        (data ?? []).map((r: any) => ({
          ...r,
          referrer: map.get(r.referrer_profile_id),
          referee: map.get(r.referee_profile_id),
        }))
      );
      setBusy(false);
    })();
  }, [isAdmin, loading]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const hay = [
        r.referrer?.full_name,
        r.referrer?.username,
        r.referrer?.referral_code,
        r.referee?.full_name,
        r.referee?.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q]);

  const totalPaid = filtered.reduce((s, r) => s + Number(r.reward_amount || 0), 0);

  if (loading || busy) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-4">
        <p className="text-sm text-destructive">Admins only.</p>
        <button onClick={() => navigate("/main")} className="text-primary text-sm underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/admin")} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="text-sm font-bold text-foreground">Referral Management</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Total Referrals</p>
              <p className="text-sm font-bold">{filtered.length}</p>
            </div>
          </div>
          <div className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Rewards Paid</p>
              <p className="text-sm font-bold">₦{totalPaid.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-3 mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search referrer or referred user…"
            className="bg-transparent outline-none text-sm flex-1 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2 border-b border-border/40 font-semibold">
            <div className="col-span-3">Referrer</div>
            <div className="col-span-3">Referred User</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">Reward</div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No referrals yet.</div>
          ) : (
            filtered.map((r) => (
              <div key={r.id} className="grid grid-cols-12 text-xs px-3 py-2 border-b border-border/20 items-center">
                <div className="col-span-3 truncate">
                  <p className="font-semibold text-foreground">{r.referrer?.full_name || r.referrer?.username || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">{r.referrer?.referral_code}</p>
                </div>
                <div className="col-span-3 truncate">{r.referee?.full_name || r.referee?.username || "—"}</div>
                <div className="col-span-2 text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
                <div className="col-span-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary capitalize">
                    {r.status}
                  </span>
                </div>
                <div className="col-span-2 text-right font-bold text-primary">₦{Number(r.reward_amount).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminReferrals;
