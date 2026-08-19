import { useEffect, useState } from "react";
import { ArrowLeft, Users, Wallet, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Txn {
  id: string;
  amount: number;
  description: string | null;
  created_at: string;
  metadata: any;
}


interface Row {
  id: string;
  referee_user_id: string;
  referee_profile_id: string;
  reward_amount: number;
  status: string;
  created_at: string;
  referee?: { full_name: string | null; username: string | null };
}

const ReferralHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEarned, setTotalEarned] = useState(0);

  const loadTxns = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("transactions")
      .select("id, amount, description, created_at, metadata")
      .eq("user_id", user.id)
      .eq("type", "referral_reward")
      .order("created_at", { ascending: false });
    setTxns((data ?? []) as Txn[]);
  };

  const load = async () => {
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!prof) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_profile_id", prof.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set((data ?? []).map((r) => r.referee_profile_id)));
    let map = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", ids);
      map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    }
    const withNames = (data ?? []).map((r: any) => ({ ...r, referee: map.get(r.referee_profile_id) }));
    setRows(withNames);
    setTotalEarned(withNames.reduce((s, r) => s + Number(r.reward_amount || 0), 0));
    await loadTxns();
    setLoading(false);
    return prof.id;
  };

  useEffect(() => {
    let refChan: any, txnChan: any;
    (async () => {
      const profileId = await load();
      if (!profileId || !user) return;
      refChan = supabase
        .channel("referral-history")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "referrals", filter: `referrer_profile_id=eq.${profileId}` },
          () => { load(); }
        )
        .subscribe();
      txnChan = supabase
        .channel("referral-txns")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` },
          () => { loadTxns(); }
        )
        .subscribe();
    })();
    return () => {
      if (refChan) supabase.removeChannel(refChan);
      if (txnChan) supabase.removeChannel(txnChan);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [user?.id]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="text-sm font-bold text-foreground">Referral History</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Total Referrals</p>
              <p className="text-sm font-bold">{rows.length}</p>
            </div>
          </div>
          <div className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Referral Earnings</p>
              <p className="text-sm font-bold">₦{totalEarned.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center text-xs text-muted-foreground">
            No referrals yet. Share your referral link to start earning ₦5,000 per invite.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="glass-card rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {r.referee?.full_name || r.referee?.username || "New User"}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono-app truncate">
                      ID: {r.referee_user_id.slice(0, 8)}…
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">₦{Number(r.reward_amount).toLocaleString()}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-primary/10 text-primary capitalize">
                      {r.status === "successful" ? "Paid" : "Pending"}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Successful</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Referral Reward Transactions */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">Reward Transactions</h2>
          </div>
          {txns.length === 0 ? (
            <div className="glass-card rounded-xl p-4 text-center text-xs text-muted-foreground">
              No referral reward transactions yet.
            </div>
          ) : (
            <div className="space-y-2">
              {txns.map((t) => {
                const refId = t.metadata?.referral_id as string | undefined;
                const refeeId = t.metadata?.referee_user_id as string | undefined;
                return (
                  <div key={t.id} className="glass-card rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {t.description || "Referral bonus"}
                        </p>
                        {refeeId && (
                          <p className="text-[10px] text-muted-foreground font-mono-app truncate">
                            Referee: {refeeId.slice(0, 8)}…
                          </p>
                        )}
                        {refId && (
                          <p className="text-[10px] text-muted-foreground font-mono-app truncate">
                            Ref: {refId.slice(0, 8)}…
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(t.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-primary">
                          +₦{Number(t.amount).toLocaleString()}
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-primary/10 text-primary">
                          Credited
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>

  );
};

export default ReferralHistory;
