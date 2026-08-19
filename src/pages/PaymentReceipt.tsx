import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, Clock, XCircle, Receipt, Download, Loader2, Copy, Sparkles, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReceiptImage } from "@/components/ReceiptImage";

interface PaymentRecord {
  id: string;
  amount: number;
  receipt_url: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  fpc_code?: string | null;
  fpc_used?: boolean;
}

const PaymentReceipt = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: pays } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const { data: codes } = await supabase
        .from("fpc_codes")
        .select("payment_id, code, used")
        .eq("user_id", user.id);

      const codeMap = new Map((codes || []).map((c) => [c.payment_id, c]));
      const merged: PaymentRecord[] = (pays || []).map((p) => {
        const c = codeMap.get(p.id);
        return { ...p, fpc_code: c?.code ?? null, fpc_used: c?.used ?? false };
      });
      setPayments(merged);
      setLoading(false);
    };
    load();
  }, [user]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success("FPC Code copied!");
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const statusConfig = (s: string) => {
    if (s === "confirmed")
      return { icon: <CheckCircle className="w-4 h-4" />, label: "Approved", color: "text-primary bg-primary/10", accent: "border-primary/30" };
    if (s === "pending")
      return { icon: <Clock className="w-4 h-4" />, label: "Pending", color: "text-yellow-400 bg-yellow-400/10", accent: "border-yellow-400/30" };
    return { icon: <XCircle className="w-4 h-4" />, label: "Rejected", color: "text-destructive bg-destructive/10", accent: "border-destructive/30" };
  };

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md mx-auto px-4 pt-5"
      >
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:bg-secondary/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-[15px] font-bold text-foreground tracking-tight">My Payments</h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
            <p className="text-[11px] text-muted-foreground">Loading payments...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No payments yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((pay, i) => {
              const cfg = statusConfig(pay.status);
              return (
                <motion.div
                  key={pay.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`glass-card rounded-2xl p-4 border ${cfg.accent}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-lg font-extrabold text-foreground">₦{pay.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(pay.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}
                        {new Date(pay.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  {pay.status === "confirmed" && (
                    <>
                      <div className="rounded-xl p-3 bg-primary/5 border border-primary/20 mb-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-primary" />
                            <p className="text-xs font-bold text-primary">Payment Confirmed</p>
                          </div>
                          <button
                            onClick={() => navigate(`/payment-approved?payment=${pay.id}`)}
                            className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" /> Celebrate
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Your payment has been verified and approved by admin.
                          {pay.reviewed_at && (
                            <> Reviewed on {new Date(pay.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.</>
                          )}
                        </p>
                      </div>

                      {pay.fpc_code && (
                        <div className="rounded-xl p-4 mb-3 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/30 relative overflow-hidden">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <p className="text-xs font-extrabold text-primary uppercase tracking-wider">🎉 Congratulations!</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                            Here is your FPC Code. Use it on the withdrawal page to unlock your funds.
                          </p>
                          <div className="flex items-stretch gap-2">
                            <div className="flex-1 inner-card rounded-lg px-3 py-2.5 font-mono text-sm font-bold text-foreground tracking-wider truncate">
                              {pay.fpc_code}
                            </div>
                            <button
                              onClick={() => copyCode(pay.fpc_code!)}
                              className="btn-cta px-3 rounded-lg flex items-center justify-center"
                              aria-label="Copy FPC code"
                            >
                              {copiedCode === pay.fpc_code ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          {pay.fpc_used && (
                            <p className="text-[10px] text-muted-foreground mt-2 italic">This code has already been used.</p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {pay.status === "pending" && (
                    <div className="rounded-xl p-3 bg-yellow-400/5 border border-yellow-400/20 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-yellow-400" />
                        <p className="text-xs font-bold text-yellow-400">Awaiting Review</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Your payment proof is being reviewed. This usually takes a few minutes.
                      </p>
                    </div>
                  )}

                  {pay.status === "rejected" && (
                    <div className="rounded-xl p-3 bg-destructive/5 border border-destructive/20 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-4 h-4 text-destructive" />
                        <p className="text-xs font-bold text-destructive">Payment Rejected</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Your payment was not approved. Please contact support if you believe this is an error.
                      </p>
                    </div>
                  )}

                  {pay.receipt_url && (
                    <button
                      onClick={() => setViewingReceipt(pay.receipt_url)}
                      className="w-full inner-card rounded-xl p-3 flex items-center gap-3 hover:border-primary/30 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary shrink-0">
                        <ReceiptImage receiptUrl={pay.receipt_url} className="w-full h-full" imgClassName="w-full h-full object-cover" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-[11px] font-bold text-foreground">View Receipt</p>
                        <p className="text-[9px] text-muted-foreground">Tap to view full payment proof</p>
                      </div>
                      <Download className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Receipt Modal */}
      {viewingReceipt && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setViewingReceipt(null)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-lg w-full max-h-[80vh] overflow-auto rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ReceiptImage receiptUrl={viewingReceipt} className="w-full min-h-[200px] rounded-2xl" imgClassName="w-full rounded-2xl" />
            <button
              onClick={() => setViewingReceipt(null)}
              className="btn-cta w-full h-10 rounded-xl text-sm font-bold mt-3"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PaymentReceipt;
