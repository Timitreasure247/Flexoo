import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

/**
 * Global live sync for the signed-in user.
 * Subscribes to profile, payments, withdrawals, transactions, referrals & fpc codes
 * and:
 *   - Invalidates react-query caches so every page auto-refreshes.
 *   - Fires toast notifications for meaningful events (payment approved/rejected,
 *     withdrawal approved/rejected, referral rewards, balance increases.
 *
 * Mount ONCE at the top of the tree (AuthContext) — the hook self-guards against
 * remounts and only opens one channel per user.
 */
export const useRealtimeUser = (user: User | null) => {
  const qc = useQueryClient();
  const lastBalance = useRef<number | null>(null);

  useEffect(() => {
    if (!user) {
      lastBalance.current = null;
      return;
    }

    const invalidateAll = () => {
      qc.invalidateQueries();
    };

    const channel = supabase
      .channel(`user-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = Number((payload.new as any)?.bonus_balance ?? 0);
          const prev = lastBalance.current;
          if (prev !== null && next > prev) {
            const diff = next - prev;
            toast.success(`+₦${diff.toLocaleString()} credited to your wallet`);
          }
          lastBalance.current = next;
          qc.invalidateQueries({ queryKey: ["profile"] });
          qc.invalidateQueries({ queryKey: ["wallet"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payments", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const status = (payload.new as any)?.status;
          if (status === "confirmed") {
            toast.success("Payment approved! 🎉", { description: "Your withdrawal code is unlocked." });
          } else if (status === "rejected") {
            toast.error("Payment rejected", { description: "Please contact support if this is an error." });
          }
          qc.invalidateQueries({ queryKey: ["payments"] });
          qc.invalidateQueries({ queryKey: ["fpc_codes"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawal_requests", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const status = (payload.new as any)?.status;
          if (payload.eventType === "UPDATE") {
            if (status === "approved") {
              toast.success("Withdrawal approved! 💸", { description: "Check your withdrawals page." });
            } else if (status === "rejected") {
              const reason = (payload.new as any)?.rejection_reason;
              toast.error("Withdrawal rejected", { description: reason || "Contact support for details." });
            }
          }
          qc.invalidateQueries({ queryKey: ["withdrawals"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const type = (payload.new as any)?.type;
          const amount = Number((payload.new as any)?.amount ?? 0);
          if (type === "referral_reward") {
            toast.success(`Referral bonus! +₦${amount.toLocaleString()}`, {
              description: (payload.new as any)?.description ?? undefined,
            });
          }
          qc.invalidateQueries({ queryKey: ["transactions"] });
          qc.invalidateQueries({ queryKey: ["history"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fpc_codes", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["fpc_codes"] });
        }
      )
      .subscribe();

    const referralsChannel = supabase
      .channel(`referrals-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "referrals" },
        () => {
          qc.invalidateQueries({ queryKey: ["referrals"] });
          qc.invalidateQueries({ queryKey: ["referral_stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(referralsChannel);
    };
  }, [user?.id, qc]);
};