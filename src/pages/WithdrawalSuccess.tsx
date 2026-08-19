import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, X as XIcon, Headphones } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type SuccessState = {
  id?: string;
  amount?: number;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  createdAt?: string;
};

type WdRow = {
  id: string;
  status: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  approved_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  rejection_reason: string | null;
};

const maskAccount = (acc?: string) => {
  if (!acc) return "••••";
  const last4 = acc.slice(-4);
  return `${"•".repeat(Math.max(0, acc.length - 4))}${last4}`;
};

const Particles = () => {
  const dots = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 4,
        delay: Math.random() * 4,
        duration: 4 + Math.random() * 6,
        color: Math.random() > 0.5 ? "#22c55e" : "#eab308",
      })),
    []
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {dots.map((d) => (
        <motion.span
          key={d.id}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 0.9, 0], y: [-10, -60, -10] }}
          transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, ease: "easeInOut" }}
          className="absolute rounded-full blur-[1px]"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            background: d.color,
            boxShadow: `0 0 12px ${d.color}`,
          }}
        />
      ))}
    </div>
  );
};

const WithdrawalSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = (location.state as SuccessState) || {};
  const [now] = useState(() => new Date());
  const [row, setRow] = useState<WdRow | null>(null);
  const [supportUrl, setSupportUrl] = useState<string>("");

  useEffect(() => {
    if (!state.amount) {
      const t = setTimeout(() => navigate("/main", { replace: true }), 100);
      return () => clearTimeout(t);
    }
  }, [state.amount, navigate]);

  // Initial fetch + realtime subscription for status changes
  useEffect(() => {
    if (!state.id) return;
    const load = async () => {
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("id,status,amount,bank_name,account_number,account_name,approved_at,reviewed_at,created_at,rejection_reason")
        .eq("id", state.id)
        .maybeSingle();
      if (data) setRow(data as WdRow);
    };
    load();
    const channel = supabase
      .channel(`wd-${state.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "withdrawal_requests", filter: `id=eq.${state.id}` },
        (payload) => {
          const next: any = payload.new;
          setRow((prev) => ({ ...(prev || {} as any), ...next }));
          if (next?.status === "approved") {
            navigate(`/withdrawal-approved?id=${state.id}`, { replace: true });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.id, navigate]);

  // Fetch WhatsApp support link for the rejection support button
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_public_settings" as any);
      const row = (data as { key: string; value: string | null }[] | null)?.find((r) => r.key === "whatsapp_url");
      if (row?.value) setSupportUrl(row.value);
    })();
  }, []);

  const createdAt = state.createdAt ? new Date(state.createdAt) : now;
  const referenceId = (state.id || `WDR-${Math.random().toString(36).slice(2, 10)}`).toUpperCase();

  const status = row?.status || "pending";
  const isRejected = status === "rejected";
  const amount = Number(row?.amount ?? state.amount ?? 0);
  const bankName = row?.bank_name || state.bankName || "—";
  const accountNumber = row?.account_number || state.accountNumber;
  const reviewedAt = row?.reviewed_at ? new Date(row.reviewed_at) : null;

  const openSupport = () => {
    const msg = [
      "Hello Support, I need help with a rejected withdrawal.",
      `User ID: ${user?.id || "—"}`,
      `Reference: ${referenceId}`,
      `Amount: ₦${amount.toLocaleString()}`,
      row?.rejection_reason ? `Reason: ${row.rejection_reason}` : "",
    ].filter(Boolean).join("\n");
    if (supportUrl) {
      const sep = supportUrl.includes("?") ? "&" : "?";
      const url = /wa\.me|whatsapp/i.test(supportUrl)
        ? `${supportUrl}${sep}text=${encodeURIComponent(msg)}`
        : supportUrl;
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      navigate("/support");
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0B0F14] overflow-hidden flex items-center justify-center px-4 py-10">
      {/* ambient glows */}
      <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full blur-[140px] pointer-events-none ${isRejected ? "bg-red-500/10" : "bg-emerald-500/10"}`} />
      <div className="absolute bottom-0 right-0 w-[380px] h-[380px] rounded-full bg-yellow-400/5 blur-[120px] pointer-events-none" />
      <Particles />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Status icon */}
        <div className="flex justify-center mb-6">
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.15 }}
            className="relative w-28 h-28 rounded-full flex items-center justify-center"
            style={{
              background: isRejected
                ? "radial-gradient(circle at 30% 30%, #fca5a5, #ef4444 55%, #7f1d1d 110%)"
                : "radial-gradient(circle at 30% 30%, #86efac, #22c55e 55%, #ca8a04 110%)",
              boxShadow: isRejected
                ? "0 0 60px rgba(239,68,68,0.45), 0 0 120px rgba(127,29,29,0.25)"
                : "0 0 60px rgba(34,197,94,0.45), 0 0 120px rgba(234,179,8,0.25)",
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full border border-white/20"
            />
            <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur flex items-center justify-center border border-white/10">
              {isRejected ? (
                <XIcon className="w-8 h-8 text-white" strokeWidth={3} />
              ) : (
                <Check className="w-8 h-8 text-white" strokeWidth={3} />
              )}
            </div>
          </motion.div>
        </div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl sm:text-4xl font-extrabold text-white text-center tracking-tight"
        >
          {isRejected ? "Withdrawal Failed" : "Request Submitted!"}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-white/60 text-center mt-2 mb-8 leading-relaxed"
        >
          {isRejected
            ? "Your withdrawal request was not approved. Please review the reason below or contact Customer Support for assistance."
            : "Your withdrawal request has been received and is currently being processed."}
        </motion.p>

        {/* Amount card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl p-5 mb-3 border border-white/5 backdrop-blur-xl text-center"
          style={{
            background: isRejected
              ? "linear-gradient(160deg, rgba(239,68,68,0.08), rgba(255,255,255,0.02))"
              : "linear-gradient(160deg, rgba(34,197,94,0.08), rgba(255,255,255,0.02))",
            boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)",
          }}
        >
          <p className="text-[10px] font-bold tracking-[0.25em] text-white/50 uppercase mb-2">Amount</p>
          <p className={`text-4xl font-extrabold tracking-tight ${isRejected ? "text-red-400" : "text-emerald-400"}`}>
            ₦{amount.toLocaleString()}
          </p>
          {isRejected ? (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
              <span className="relative inline-flex w-2 h-2 rounded-full bg-red-400" />
              <span className="text-[11px] font-semibold text-red-300">Rejected</span>
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-yellow-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-yellow-400" />
              </span>
              <span className="text-[11px] font-semibold text-yellow-300">Processing</span>
              <span className="text-[11px] text-white/50">· Usually within 24 hours</span>
            </div>
          )}
        </motion.div>

        {isRejected && row?.rejection_reason && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="rounded-2xl p-4 mb-3 border border-red-500/20 bg-red-500/5"
          >
            <p className="text-[10px] font-bold tracking-[0.2em] text-red-300/80 uppercase mb-1.5">Reason</p>
            <p className="text-sm text-white/90 leading-relaxed">{row.rejection_reason}</p>
          </motion.div>
        )}

        {/* Details card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl p-4 mb-6 border border-white/5 backdrop-blur-xl divide-y divide-white/5"
          style={{
            background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          }}
        >
          <Row label="Bank" value={bankName} />
          <Row label="Account" value={maskAccount(accountNumber)} mono />
          <Row label="Reference ID" value={referenceId} mono />
          <Row
            label="Date & Time"
            value={createdAt.toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
          {isRejected && reviewedAt && (
            <Row
              label="Reviewed"
              value={reviewedAt.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
          )}
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">Status</span>
            {isRejected ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-300">
                <XIcon className="w-3.5 h-3.5" />
                Rejected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-yellow-300">
                <Clock className="w-3.5 h-3.5" />
                Processing
              </span>
            )}
          </div>
        </motion.div>

        {isRejected && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            whileTap={{ scale: 0.98 }}
            onClick={openSupport}
            className="w-full h-13 py-3.5 rounded-2xl font-bold text-white text-sm tracking-wide mb-3 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(90deg, #ef4444 0%, #f97316 100%)",
              boxShadow: "0 10px 30px -10px rgba(239,68,68,0.6)",
            }}
          >
            <Headphones className="w-4 h-4" />
            Contact Customer Support
          </motion.button>
        )}

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/main", { replace: true })}
          className={`w-full h-13 py-3.5 rounded-2xl font-bold text-sm tracking-wide ${isRejected ? "text-white bg-white/5 border border-white/10" : "text-black"}`}
          style={
            isRejected
              ? undefined
              : {
                  background: "linear-gradient(90deg, #22c55e 0%, #a3e635 50%, #eab308 100%)",
                  boxShadow: "0 10px 30px -10px rgba(34,197,94,0.6), 0 0 20px rgba(234,179,8,0.25)",
                }
          }
        >
          Back to Dashboard
        </motion.button>
      </motion.div>
    </div>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-center justify-between py-2.5">
    <span className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">{label}</span>
    <span className={`text-sm text-white font-semibold ${mono ? "font-mono tracking-wider" : ""}`}>{value}</span>
  </div>
);

export default WithdrawalSuccess;
