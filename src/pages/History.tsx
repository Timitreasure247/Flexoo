import { useState, useEffect } from "react";
import { ArrowLeft, ArrowDownToLine, ArrowUpRight, Clock, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Transaction {
  type: "credit" | "debit";
  label: string;
  amount: string;
  date: string;
  time: string;
  linkTo?: string;
  sortKey: number;
}

const TYPE_LABELS: Record<string, string> = {
  signup_bonus: "Signup Bonus",
  referral_reward: "Referral Reward",
  ad_reward: "Watch & Earn Reward",
  spin_reward: "Spin & Win",
  task_reward: "Daily Task Reward",
  milestone_reward: "Milestone Reward",
  promo_bonus: "Promotional Bonus",
};

const prettifyType = (t: string) =>
  TYPE_LABELS[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const History = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [{ data: withdrawals }, { data: payments }, { data: rewardTxns }] = await Promise.all([
        supabase.from("withdrawal_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      // Enrich referral rewards with referee username
      const refereeIds = ((rewardTxns || []) as Array<{ type: string; metadata: unknown }>)
        .filter((t) => t.type === "referral_reward")
        .map((t) => (t.metadata as { referee_user_id?: string } | null)?.referee_user_id)
        .filter((v): v is string => Boolean(v));
      let refereeMap: Record<string, string> = {};
      if (refereeIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, username, full_name")
          .in("user_id", refereeIds);
        refereeMap = Object.fromEntries(
          (profs || []).map((p: { user_id: string; username: string | null; full_name: string | null }) => [
            p.user_id,
            p.username || p.full_name || p.user_id.slice(0, 8),
          ])
        );
      }

      const txns: Transaction[] = [];
      const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const fmtTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      // All wallet-affecting rewards live in the transactions table — render them all.
      (rewardTxns || []).forEach((t: { id: string; type: string; amount: number; created_at: string; metadata: unknown; description: string | null }) => {
        const d = new Date(t.created_at);
        let label = prettifyType(t.type);
        if (t.type === "referral_reward") {
          const meta = (t.metadata as { referee_user_id?: string } | null) || {};
          const name = meta.referee_user_id ? refereeMap[meta.referee_user_id] : null;
          if (name) label = `Referral Reward · @${name}`;
        } else if (t.description) {
          label = `${label} · ${t.description}`;
        }
        const amt = Number(t.amount);
        txns.push({
          type: amt >= 0 ? "credit" : "debit",
          label,
          amount: `${amt >= 0 ? "+" : "-"}₦${Math.abs(amt).toLocaleString()}`,
          date: fmtDate(d),
          time: fmtTime(d),
          sortKey: d.getTime(),
        });
      });

      withdrawals?.forEach((w) => {
        const d = new Date(w.created_at);
        txns.push({
          type: "debit",
          label: `Withdrawal (${w.status})`,
          amount: `-₦${Number(w.amount).toLocaleString()}`,
          date: fmtDate(d),
          time: fmtTime(d),
          sortKey: d.getTime(),
        });
      });

      payments?.forEach((p) => {
        const d = new Date(p.created_at);
        txns.push({
          type: "debit",
          label: `Payment (${p.status})`,
          amount: `-₦${Number(p.amount).toLocaleString()}`,
          date: fmtDate(d),
          time: fmtTime(d),
          linkTo: "/payment-receipt",
          sortKey: d.getTime(),
        });
      });

      txns.sort((a, b) => b.sortKey - a.sortKey);
      setTransactions(txns);
      setLoading(false);
    };

    load();

    // Live-refresh when a new reward hits transactions or a payment/withdrawal changes.
    const channel = supabase
      .channel(`history-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md mx-auto px-4 pt-4"
      >
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/main")} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="text-sm font-bold text-foreground">Transaction History</h1>
          <div className="ml-auto glass-card px-3 py-1 rounded-full">
            <p className="text-[10px] font-bold text-muted-foreground">{transactions.length} items</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
            <p className="text-[11px] text-muted-foreground">Loading history...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Clock className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-[11px] text-muted-foreground">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`glass-card rounded-lg p-3 flex items-center gap-3 ${tx.linkTo ? "cursor-pointer hover:border-primary/30" : ""}`}
                onClick={() => tx.linkTo && navigate(tx.linkTo)}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.type === "credit" ? "bg-primary/10" : "bg-destructive/10"}`}>
                  {tx.type === "credit" ? (
                    <ArrowDownToLine className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-foreground truncate">{tx.label}</p>
                  <p className="text-[9px] text-muted-foreground">{tx.date} · {tx.time}</p>
                </div>
                <p className={`text-[12px] font-bold ${tx.type === "credit" ? "text-primary" : "text-destructive"}`}>
                  {tx.amount}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default History;
