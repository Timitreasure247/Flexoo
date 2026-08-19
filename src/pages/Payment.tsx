import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  X,
  Copy,
  Upload,
  ExternalLink,
  User,
  Landmark,
  CreditCard,
  Shield,
  Clock,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PaymentLoadingOverlay from "@/components/PaymentLoadingOverlay";


const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

type Step = "notice" | "payment" | "success";

type ActiveAccount = {
  bank_name: string;
  account_name: string;
  account_number: string;
  payment_method: string;
  qr_code: string | null;
};

const DEFAULT_ACCOUNT: ActiveAccount = {
  bank_name: "Moniepoint MFB",
  account_name: "FLEXOO DIGITAL SERVICES",
  account_number: "8137498802",
  payment_method: "Bank Transfer",
  qr_code: null,
};

const Payment = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("notice");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [account, setAccount] = useState<ActiveAccount>(DEFAULT_ACCOUNT);
  const [price, setPrice] = useState<number>(7500);
  const [transferLink, setTransferLink] = useState<string>("");
  const [preparing, setPreparing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Fetch admin-configured default/active account
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("payment_accounts")
        .select("bank_name, account_name, account_number, payment_method, qr_code, is_default, status")
        .eq("status", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setAccount(data as ActiveAccount);
      const { data: s } = await supabase.rpc("get_public_settings" as any);
      (s || []).forEach((row: { key: string; value: string | null }) => {
        if (row.key === "withdrawal_code_price") {
          const n = Number(row.value);
          if (Number.isFinite(n) && n > 0) setPrice(n);
        } else if (row.key === "pay_with_transfer_link") {
          setTransferLink(row.value || "");
        }
      });
    };
    load();
  }, []);

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setReceiptPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!receiptFile || !user) return;
    setSubmitting(true);

    try {
      const ext = receiptFile.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("receipts")
        .upload(filePath, receiptFile, { contentType: receiptFile.type || undefined });

      if (uploadErr) throw uploadErr;

      // Store the storage object path only; the `receipts` bucket is private,
      // so viewers (user + admin) resolve a signed URL at render time.
      const { data: inserted, error: insertErr } = await supabase
        .from("payments")
        .insert({
          user_id: user.id,
          amount: price,
          receipt_url: filePath,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      navigate(`/payment-review?id=${inserted.id}`, { replace: true });
      return;
    } catch (err: any) {
      toast.error(err.message || "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <PaymentLoadingOverlay show={preparing} />

      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-payment" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(150, 20%, 40%)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-payment)" />
        </svg>
      </div>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px]" />

      {[
        { top: "10%", left: "6%", delay: "0s", size: "w-1.5 h-1.5" },
        { top: "50%", right: "12%", delay: "2s", size: "w-1 h-1" },
        { top: "70%", left: "45%", delay: "3s", size: "w-1.5 h-1.5" },
        { top: "28%", right: "4%", delay: "1s", size: "w-1 h-1" },
      ].map((p, i) => (
        <div
          key={i}
          className={`particle absolute ${p.size} rounded-full bg-primary/30`}
          style={{ top: p.top, left: p.left, right: (p as any).right, animationDelay: p.delay }}
        />
      ))}

      <div className="relative z-10 max-w-md mx-auto px-4 pt-5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-3 mb-7"
        >
          <button
            onClick={() => step === "notice" ? navigate(-1) : setStep("notice")}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:bg-secondary/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 rounded-full bg-[#F5C518] flex items-center justify-center shadow-lg shadow-[#F5C518]/10">
            <ShoppingCart className="w-5 h-5 text-background" />
          </div>
          <p className="text-[15px] font-bold text-foreground tracking-tight">Buy Withdrawal Code</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === "notice" ? (
            <motion.div
              key="notice"
              variants={container}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
            >
              <motion.div variants={item} className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#F5C518]/15 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-[#F5C518]" />
                  </div>
                  <h2 className="text-[17px] font-bold text-foreground tracking-tight">Important Payment Notice</h2>
                </div>

                <ul className="space-y-3.5 mb-6">
                  <li className="flex items-start gap-3">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Transfer the <span className="font-semibold text-foreground">exact amount</span> shown on this page.
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Upload a clear <span className="font-semibold text-foreground">payment screenshot</span> immediately after transfer.
                    </p>
                  </li>
                </ul>

                <div
                  className="rounded-xl p-4 mb-6"
                  style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)" }}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-destructive">Avoid using Opay bank</span>. Due to temporary network issues from Opay servers, payments made with Opay may not be confirmed. Please use{" "}
                      <span className="font-semibold text-foreground">any other Nigerian bank</span> for instant confirmation.
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5 mb-7">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Payments made with other banks are confirmed within minutes.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <X className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Do not dispute your payment under any circumstances — disputes delay confirmation.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (preparing) return;
                    setPreparing(true);
                    setTimeout(() => {
                      setStep("payment");
                      setPreparing(false);
                    }, 2500);
                  }}
                  disabled={preparing}
                  aria-disabled={preparing}
                  className="btn-danger w-full h-12 rounded-xl text-sm flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {preparing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing…</>
                  ) : (
                    "I Understand"
                  )}
                </button>
              </motion.div>
            </motion.div>

          ) : step === "payment" ? (
            <motion.div
              key="payment"
              variants={container}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
              className="space-y-4"
            >
              <motion.div variants={item} className="glass-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                    Payment Instructions
                  </p>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    ₦{price.toLocaleString()}
                  </span>
                </div>

                <p className="text-[13px] text-muted-foreground mb-5">
                  Transfer <span className="font-semibold text-foreground">₦{price.toLocaleString()}</span> to the account below:
                </p>

                <div className="space-y-2.5 mb-5">
                  {[
                    { icon: Landmark, label: "BANK", value: account.bank_name, copyVal: account.bank_name },
                    { icon: CreditCard, label: "ACCOUNT NUMBER", value: account.account_number, copyVal: account.account_number, mono: true },
                    { icon: User, label: "ACCOUNT NAME", value: account.account_name, copyVal: account.account_name },
                    { icon: CreditCard, label: "METHOD", value: account.payment_method, copyVal: account.payment_method },
                  ].map(({ icon: Icon, label, value, copyVal, mono }) => (
                    <motion.div
                      key={label}
                      whileTap={{ scale: 0.99 }}
                      className="inner-card flex items-center gap-3 rounded-xl px-4 py-3.5"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">{label}</p>
                        <p className={`text-sm font-bold text-foreground ${mono ? "font-mono-app tracking-wide" : ""}`}>
                          {value}
                        </p>
                      </div>
                      <button
                        onClick={() => copyText(copyVal, label)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                      >
                        {copiedField === label ? (
                          <CheckCircle className="w-4 h-4 text-primary" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </motion.div>
                  ))}
                </div>

                {account.qr_code && (
                  <div className="flex flex-col items-center gap-2 mb-5">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">Scan to Pay</p>
                    <img src={account.qr_code} alt="Payment QR code" className="w-40 h-40 rounded-xl border border-border object-contain bg-white p-2" />
                  </div>
                )}

                {transferLink && (
                  <a
                    href={transferLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-cta w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2 mb-4"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Pay with Transfer Link
                  </a>
                )}
              </motion.div>

              <motion.div variants={item} className="glass-card rounded-2xl p-5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-3">
                  After Payment
                </p>
                <p className="text-[13px] text-muted-foreground mb-4">
                  Upload your payment receipt below
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`upload-zone w-full rounded-xl p-7 flex flex-col items-center gap-2.5 mb-5 ${receiptPreview ? "border-primary/50" : ""}`}
                >
                  {receiptPreview ? (
                    <img
                      src={receiptPreview}
                      alt="Receipt preview"
                      className="w-full max-h-48 object-contain rounded-lg"
                    />
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-primary/8 flex items-center justify-center mb-1">
                        <Upload className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">Tap to upload receipt</p>
                      <p className="text-[11px] text-muted-foreground">JPG, PNG • Max 5MB</p>
                    </>
                  )}
                </button>

                <button
                  onClick={handleSubmit}
                  className={`w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    receiptFile && !submitting
                      ? "btn-cta"
                      : "bg-secondary text-muted-foreground cursor-not-allowed"
                  }`}
                  disabled={!receiptFile || submitting}
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                  ) : (
                    <><Shield className="w-4 h-4" /> Submit Payment Proof</>
                  )}
                </button>
              </motion.div>
            </motion.div>
          ) : step === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex flex-col items-center justify-center py-8"
            >
              {/* Pending status card */}
              <div className="relative mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.5, type: "spring", stiffness: 200, damping: 15 }}
                  className="w-24 h-24 rounded-full bg-yellow-500/15 flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, duration: 0.4, type: "spring", stiffness: 250, damping: 12 }}
                    className="w-16 h-16 rounded-full bg-yellow-500/25 flex items-center justify-center"
                  >
                    <Clock className="w-8 h-8 text-yellow-400" />
                  </motion.div>
                </motion.div>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.6 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  transition={{ delay: 0.5, duration: 1.2, repeat: Infinity, repeatDelay: 0.5 }}
                  className="absolute inset-0 w-24 h-24 rounded-full border-2 border-yellow-400/30"
                />
              </div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-lg font-bold text-foreground mb-1"
              >
                Payment Not Confirmed
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
                className="text-[13px] text-muted-foreground text-center max-w-[280px] mb-3 leading-relaxed"
              >
                Your payment proof has been submitted and is awaiting admin review.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="glass-card rounded-xl p-4 w-full mb-6"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <p className="text-xs font-bold text-yellow-400">Pending Review</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  An admin will verify your payment receipt shortly. You'll receive confirmation once your payment is approved. This usually takes a few minutes.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.05 }}
                className="w-full space-y-2.5"
              >
                <button
                  onClick={() => navigate("/main")}
                  className="btn-cta w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center"
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={() => navigate("/payment-receipt")}
                  className="w-full h-11 rounded-xl text-sm font-semibold text-primary hover:text-foreground transition-colors"
                >
                  View My Payments
                </button>
                <button
                  onClick={() => navigate("/history")}
                  className="w-full h-11 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  View Transaction History
                </button>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Payment;
