import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, Copy, Check, Sparkles, PartyPopper, ArrowRight, Loader2, Wallet, Receipt, Share2, Download } from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ApprovedPayment {
  id: string;
  amount: number;
  reviewed_at: string | null;
  fpc_code: string | null;
  fpc_used: boolean;
}

const fireConfetti = () => {
  const duration = 3000;
  const end = Date.now() + duration;
  const colors = ["#a3e635", "#84cc16", "#22c55e", "#facc15", "#fb923c"];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  // Big burst from center
  setTimeout(() => {
    confetti({
      particleCount: 120,
      spread: 100,
      origin: { y: 0.5 },
      colors,
      startVelocity: 45,
    });
  }, 250);
};

const PaymentApproved = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const paymentId = params.get("payment");

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<ApprovedPayment | null>(null);
  const [copied, setCopied] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      let query = supabase
        .from("payments")
        .select("id, amount, reviewed_at, status")
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .order("reviewed_at", { ascending: false, nullsFirst: false })
        .limit(1);

      if (paymentId) {
        query = supabase
          .from("payments")
          .select("id, amount, reviewed_at, status")
          .eq("user_id", user.id)
          .eq("id", paymentId)
          .limit(1);
      }

      const { data: pays } = await query;
      const pay = pays?.[0];

      if (!pay || pay.status !== "confirmed") {
        setLoading(false);
        return;
      }

      const { data: code } = await supabase
        .from("fpc_codes")
        .select("code, used")
        .eq("payment_id", pay.id)
        .maybeSingle();

      setPayment({
        id: pay.id,
        amount: Number(pay.amount),
        reviewed_at: pay.reviewed_at,
        fpc_code: code?.code ?? null,
        fpc_used: code?.used ?? false,
      });
      setLoading(false);
    };
    load();
  }, [user, paymentId]);

  useEffect(() => {
    if (payment?.fpc_code && !firedRef.current) {
      firedRef.current = true;
      fireConfetti();
    }
  }, [payment]);

  const copyCode = async () => {
    if (!payment?.fpc_code) return;
    try {
      await navigator.clipboard.writeText(payment.fpc_code);
      setCopied(true);
      toast.success("FPC Code copied to clipboard!");
      // small celebratory burst
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#a3e635", "#84cc16", "#facc15"],
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  };

  const maskCode = (code: string) => {
    if (code.length <= 6) return code.replace(/.(?=.{2})/g, "•");
    const head = code.slice(0, 4);
    const tail = code.slice(-2);
    return `${head}${"•".repeat(Math.max(4, code.length - 6))}${tail}`;
  };

  const buildShareCard = async (): Promise<Blob | null> => {
    if (!payment) return null;
    const W = 1080;
    const H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a0f0a");
    bg.addColorStop(1, "#111c0a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Glow blobs
    const glow = (x: number, y: number, r: number, color: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    glow(W / 2, 200, 600, "rgba(132, 204, 22, 0.35)");
    glow(W, H, 700, "rgba(251, 146, 60, 0.18)");

    // Card
    const cx = 80;
    const cy = 220;
    const cw = W - 160;
    const ch = H - 440;
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    const r = 48;
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    ctx.arcTo(cx + cw, cy, cx + cw, cy + ch, r);
    ctx.arcTo(cx + cw, cy + ch, cx, cy + ch, r);
    ctx.arcTo(cx, cy + ch, cx, cy, r);
    ctx.arcTo(cx, cy, cx + cw, cy, r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(132, 204, 22, 0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top badge
    ctx.fillStyle = "#a3e635";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✓ PAYMENT APPROVED", W / 2, 130);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 76px system-ui, sans-serif";
    ctx.fillText("Congratulations! 🎉", W / 2, cy + 130);

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "32px system-ui, sans-serif";
    ctx.fillText("My payment has been approved", W / 2, cy + 185);

    // Amount
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "30px system-ui, sans-serif";
    ctx.fillText("APPROVED AMOUNT", W / 2, cy + 290);

    ctx.fillStyle = "#a3e635";
    ctx.font = "bold 140px system-ui, sans-serif";
    ctx.fillText(`₦${payment.amount.toLocaleString()}`, W / 2, cy + 430);

    // Divider
    ctx.strokeStyle = "rgba(132, 204, 22, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 80, cy + 500);
    ctx.lineTo(cx + cw - 80, cy + 500);
    ctx.stroke();

    // FPC Code
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "28px system-ui, sans-serif";
    ctx.fillText("MY FPC CODE", W / 2, cy + 570);

    const masked = payment.fpc_code ? maskCode(payment.fpc_code) : "FPC-••••••";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 70px ui-monospace, 'Courier New', monospace";
    ctx.fillText(masked, W / 2, cy + 660);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "italic 24px system-ui, sans-serif";
    ctx.fillText("(code partially hidden for security)", W / 2, cy + 710);

    // Footer
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "28px system-ui, sans-serif";
    ctx.fillText("Join me — start earning today", W / 2, H - 160);

    ctx.fillStyle = "#a3e635";
    ctx.font = "bold 38px system-ui, sans-serif";
    ctx.fillText("flexoo", W / 2, H - 100);

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  };

  const [sharing, setSharing] = useState(false);
  const handleShare = async () => {
    setSharing(true);
    try {
      const blob = await buildShareCard();
      if (!blob) throw new Error("no blob");
      const file = new File([blob], "my-success.png", { type: "image/png" });
      const shareData: ShareData = {
        title: "I got approved! 🎉",
        text: `My payment of ₦${payment?.amount.toLocaleString()} was just approved!`,
        files: [file],
      };
      if (navigator.canShare && navigator.canShare(shareData) && navigator.share) {
        await navigator.share(shareData);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "my-success.png";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Share card downloaded!");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Could not share card");
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Loading your approval...</p>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <Receipt className="w-12 h-12 text-muted-foreground/40 mb-3" />
        <h1 className="text-lg font-bold text-foreground mb-1">No approved payment yet</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your payment is still under review. We'll let you know once it's approved.
        </p>
        <button
          onClick={() => navigate("/payment-receipt")}
          className="btn-cta px-6 h-11 rounded-xl text-sm font-bold"
        >
          View My Payments
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden pb-10">
      {/* Glow background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md mx-auto px-5 pt-10"
      >
        {/* Hero */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}
          className="flex flex-col items-center text-center mb-8"
        >
          <div className="relative mb-4">
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full bg-primary/30 blur-2xl"
            />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_60px_rgba(132,204,22,0.5)]">
              <CheckCircle className="w-12 h-12 text-primary-foreground" strokeWidth={2.5} />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 mb-3"
          >
            <PartyPopper className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
              Payment Approved
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-2xl font-extrabold text-foreground mb-2"
          >
            Congratulations! 🎉
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-sm text-muted-foreground leading-relaxed max-w-xs"
          >
            Your payment of{" "}
            <span className="font-bold text-foreground">
              ₦{payment.amount.toLocaleString()}
            </span>{" "}
            has been verified and approved by admin.
          </motion.p>
        </motion.div>

        {/* FPC Code Card */}
        {payment.fpc_code ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="glass-card rounded-2xl p-5 border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent relative overflow-hidden mb-5"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/20 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-xs font-extrabold text-primary uppercase tracking-wider">
                  Your FPC Code
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
                Use this code on the withdrawal page to unlock and process your funds.
                Keep it safe — it can only be used once.
              </p>

              <div className="flex items-stretch gap-2 mb-3">
                <div className="flex-1 inner-card rounded-xl px-4 py-3.5 font-mono text-base font-bold text-foreground tracking-widest text-center truncate border border-primary/20">
                  {payment.fpc_code}
                </div>
                <button
                  onClick={copyCode}
                  className="btn-cta px-4 rounded-xl flex items-center justify-center min-w-[52px]"
                  aria-label="Copy FPC code"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              {payment.fpc_used ? (
                <div className="rounded-lg px-3 py-2 bg-muted/40 border border-border">
                  <p className="text-[11px] text-muted-foreground italic text-center">
                    This code has already been used.
                  </p>
                </div>
              ) : (
                <button
                  onClick={copyCode}
                  className="w-full text-center text-[11px] text-primary font-semibold hover:underline"
                >
                  {copied ? "Copied to clipboard ✓" : "Tap to copy code"}
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="glass-card rounded-2xl p-5 border border-yellow-400/30 mb-5"
          >
            <p className="text-sm font-bold text-yellow-400 mb-1">FPC Code generating...</p>
            <p className="text-[11px] text-muted-foreground">
              Your code is being generated. Please refresh in a few seconds.
            </p>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="space-y-2.5"
        >
          <button
            onClick={() => navigate("/withdraw-request")}
            className="btn-cta w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            Withdraw Now
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="w-full h-11 rounded-xl text-sm font-semibold bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {sharing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            Share My Success
            <Download className="w-3.5 h-3.5 opacity-60" />
          </button>
          <button
            onClick={() => navigate("/payment-receipt")}
            className="w-full h-11 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-secondary/50 transition-colors flex items-center justify-center gap-2"
          >
            <Receipt className="w-4 h-4" />
            View All Payments
          </button>
          <button
            onClick={() => navigate("/main")}
            className="w-full h-10 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default PaymentApproved;
