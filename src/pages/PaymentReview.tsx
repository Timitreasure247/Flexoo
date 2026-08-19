import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clock, ArrowLeft, LifeBuoy, Loader2, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface PaymentRow {
  id: string;
  amount: number;
  status: string;
  receipt_url: string | null;
  created_at: string;
}

const Particles = () => {
  const dots = Array.from({ length: 22 }).map((_, i) => {
    const size = 2 + Math.random() * 4;
    return {
      key: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size,
      delay: Math.random() * 6,
      duration: 6 + Math.random() * 8,
      color:
        i % 3 === 0
          ? "rgba(163,230,53,0.55)"
          : i % 3 === 1
          ? "rgba(250,204,21,0.5)"
          : "rgba(255,255,255,0.35)",
    };
  });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {dots.map((d) => (
        <motion.span
          key={d.key}
          className="absolute rounded-full"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            background: d.color,
            boxShadow: `0 0 ${d.size * 3}px ${d.color}`,
          }}
          animate={{ y: [0, -30, 0], opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: d.duration,
            delay: d.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

const PaymentReview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const paymentId = params.get("id");
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const query = supabase
        .from("payments")
        .select("id, amount, status, receipt_url, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const { data } = paymentId
        ? await supabase
            .from("payments")
            .select("id, amount, status, receipt_url, created_at")
            .eq("user_id", user.id)
            .eq("id", paymentId)
            .maybeSingle()
            .then((r) => ({ data: r.data ? [r.data] : [] }))
        : await query;

      if (cancelled) return;
      const p = data?.[0] as PaymentRow | undefined;
      if (p) setPayment(p);
      setLoading(false);

      if (p && p.status === "confirmed") {
        navigate(`/payment-approved?payment=${p.id}`, { replace: true });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, paymentId, navigate]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !payment?.id) return;
    const channel = supabase
      .channel(`payment-${payment.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payments",
          filter: `id=eq.${payment.id}`,
        },
        (payload) => {
          const next = payload.new as PaymentRow;
          setPayment((prev) => (prev ? { ...prev, ...next } : next));
          if (next.status === "confirmed") {
            navigate(`/payment-approved?payment=${payment.id}`, { replace: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, payment?.id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex flex-col items-center justify-center px-6 text-center text-white">
        <p className="text-sm text-white/60 mb-4">No payment found.</p>
        <button
          onClick={() => navigate("/main")}
          className="btn-cta px-6 h-11 rounded-xl text-sm font-bold"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (payment.status === "rejected") {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex flex-col items-center justify-center px-6 text-center text-white">
        <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
          <Info className="w-9 h-9 text-destructive" />
        </div>
        <h1 className="text-xl font-bold mb-2">Payment Rejected</h1>
        <p className="text-sm text-white/60 max-w-xs mb-6">
          Your payment could not be verified. Please contact support for help.
        </p>
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => navigate("/support")}
            className="flex-1 h-11 rounded-xl text-sm font-semibold bg-white/5 border border-white/10 text-white"
          >
            Contact Support
          </button>
          <button
            onClick={() => navigate("/main")}
            className="flex-1 h-11 rounded-xl text-sm font-semibold btn-cta"
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  const receiptShort = payment.id.slice(0, 8).toUpperCase();
  const dt = new Date(payment.created_at);

  return (
    <div
      className="relative min-h-screen overflow-hidden pb-10"
      style={{ background: "#0B0F14" }}
    >
      <Particles />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-yellow-400/10 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-md mx-auto px-5 pt-5 text-white"
      >
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/main")}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition-all hover:bg-white/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="text-[15px] font-bold tracking-tight">Payment Status</p>
        </div>

        {/* Hero */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.15 }}
          className="flex flex-col items-center text-center mb-6"
        >
          <div className="relative mb-4">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full bg-yellow-400/40 blur-2xl"
            />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center shadow-[0_0_60px_rgba(250,204,21,0.55)]">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <Clock className="w-11 h-11 text-[#0B0F14]" strokeWidth={2.5} />
              </motion.div>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold mb-2">Payment Under Review</h1>
          <p className="text-sm text-white/60 leading-relaxed max-w-xs">
            Your payment receipt has been received and is currently being verified by
            our team. Your withdrawal code will be activated once payment is approved.
          </p>
        </motion.div>

        {/* Details card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl p-5 mb-4 backdrop-blur-xl bg-white/[0.04] border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]"
        >
          <div className="space-y-3.5">
            <Row label="Amount Paid" value={`₦${Number(payment.amount).toLocaleString()}`} bold />
            <Row label="Payment Method" value="Bank Transfer · Moniepoint" />
            <Row label="Receipt Number" value={receiptShort} mono />
            <Row
              label="Date & Time"
              value={`${dt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })} · ${dt.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}`}
            />
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] uppercase tracking-wider text-white/50">
                Status
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-yellow-400/15 text-yellow-300 border border-yellow-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" />
                Under Review
              </span>
            </div>
          </div>
        </motion.div>

        {/* Notice card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl p-4 mb-6 backdrop-blur-xl bg-yellow-400/[0.05] border border-yellow-400/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 shrink-0 rounded-full bg-yellow-400/15 flex items-center justify-center">
              <Info className="w-4 h-4 text-yellow-300" />
            </div>
            <div>
              <p className="text-sm font-bold mb-1">Verification Notice</p>
              <p className="text-[12px] leading-relaxed text-white/60">
                Payment verification usually takes between 5 minutes and 24 hours
                depending on workload. This page will update automatically once your
                payment is approved.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="space-y-2.5"
        >
          <button
            onClick={() => navigate("/main")}
            className="w-full h-12 rounded-xl text-sm font-bold text-[#0B0F14] bg-gradient-to-r from-yellow-300 via-lime-300 to-primary shadow-[0_10px_30px_-10px_rgba(163,230,53,0.6)]"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate("/support")}
            className="w-full h-11 rounded-xl text-sm font-semibold bg-white/5 border border-white/10 text-white flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
          >
            <LifeBuoy className="w-4 h-4" />
            Contact Support
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

const Row = ({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
}) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[11px] uppercase tracking-wider text-white/50">{label}</span>
    <span
      className={`text-sm text-white ${bold ? "font-extrabold text-base" : "font-semibold"} ${
        mono ? "font-mono tracking-wider" : ""
      }`}
    >
      {value}
    </span>
  </div>
);

export default PaymentReview;
