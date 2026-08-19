import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Banknote, AlertCircle, KeyRound, Check, ChevronsUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const NIGERIAN_BANKS = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Globus Bank",
  "Guaranty Trust Bank (GTBank)",
  "Keystone Bank",
  "Lotus Bank",
  "Moniepoint Microfinance Bank",
  "Opay",
  "PalmPay",
  "Parallex Bank",
  "Polaris Bank",
  "Premium Trust Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "Titan Trust Bank",
  "Union Bank",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
  "Kuda Bank",
  "TAJ Bank",
  "Jaiz Bank",
  "MoMo PSB",
  "SMARTCASH PSB",
];

const WithdrawRequest = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [fpcCode, setFpcCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: profile }, { data: requests }] = await Promise.all([
        supabase.from("profiles").select("bonus_balance").eq("user_id", user.id).single(),
        supabase.from("withdrawal_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      ]);
      setBalance(profile?.bonus_balance || 0);
      setPendingRequests(requests || []);
    };
    load();
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    const amt = Number(amount);
    if (!amt || amt < 1000) return toast.error("Minimum withdrawal is ₦1,000");
    if (amt > balance) return toast.error("Insufficient balance");
    if (!bankName.trim()) return toast.error("Enter bank name");
    if (!accountNumber.trim() || accountNumber.length < 10) return toast.error("Enter valid account number");
    if (!accountName.trim()) return toast.error("Enter account name");
    const codeInput = fpcCode.trim().toUpperCase();
    if (!codeInput) return toast.error("Enter your FPC Code");

    setSubmitting(true);

    // Validate FPC code: must belong to this user, exist, and be unused
    const { data: codeRow, error: codeErr } = await supabase
      .from("fpc_codes")
      .select("id, used")
      .eq("user_id", user.id)
      .eq("code", codeInput)
      .maybeSingle();

    if (codeErr || !codeRow) {
      toast.error("Invalid FPC Code. Make sure you typed it correctly.");
      setSubmitting(false);
      return;
    }
    if (codeRow.used) {
      toast.error("This FPC Code has already been used.");
      setSubmitting(false);
      return;
    }

    const { data: inserted, error } = await supabase
      .from("withdrawal_requests")
      .insert({
        user_id: user.id,
        amount: amt,
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim(),
        bvn: codeInput, // legacy NOT NULL safety — also stored below in fpc_code
        fpc_code: codeInput,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      toast.error("Failed to submit request");
      setSubmitting(false);
      return;
    }

    // Mark FPC code as used (single-use)
    await supabase
      .from("fpc_codes")
      .update({ used: true, used_at: new Date().toISOString(), used_for_withdrawal_id: inserted.id })
      .eq("id", codeRow.id);

    // Deduct from balance
    await supabase.from("profiles").update({ bonus_balance: balance - amt }).eq("user_id", user.id);

    toast.success("Withdrawal request submitted!");
    setBalance(balance - amt);
    setSubmitting(false);
    navigate("/withdrawal-success", {
      replace: true,
      state: {
        id: inserted.id,
        amount: amt,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        createdAt: new Date().toISOString(),
      },
    });
    return;
  };

  const statusColor = (s: string) => s === "pending" ? "text-yellow-400" : s === "approved" ? "text-primary" : "text-destructive";

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <Banknote className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-sm font-bold text-foreground">Withdraw Funds</h1>
            <p className="text-[10px] text-muted-foreground">Balance: <span className="font-bold text-foreground">₦{balance.toLocaleString()}</span></p>
          </div>
        </div>

        {/* Info */}
        <div className="glass-card rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Withdrawal requires a valid <span className="font-bold text-foreground">FPC Code</span> from an approved payment. Each code can only be used once. Minimum withdrawal: <span className="font-bold text-foreground">₦1,000</span>.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-3 mb-6">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Amount (₦)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full h-10 rounded-lg bg-secondary border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Bank Name</label>
            <Popover open={bankOpen} onOpenChange={setBankOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={bankOpen}
                  className="w-full h-10 rounded-lg bg-secondary border border-border px-3 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <span className={cn("truncate", !bankName && "text-muted-foreground/50")}>
                    {bankName || "Select your bank"}
                  </span>
                  <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0 w-[--radix-popover-trigger-width] bg-popover border-border"
                align="start"
                sideOffset={4}
              >
                <Command>
                  <CommandInput placeholder="Search bank..." className="h-9 text-sm" />
                  <CommandList className="max-h-[240px]">
                    <CommandEmpty>No bank found.</CommandEmpty>
                    <CommandGroup>
                      {NIGERIAN_BANKS.map((b) => (
                        <CommandItem
                          key={b}
                          value={b}
                          onSelect={() => {
                            setBankName(b);
                            setBankOpen(false);
                          }}
                          className="text-sm"
                        >
                          <Check className={cn("mr-2 h-4 w-4", bankName === b ? "opacity-100" : "opacity-0")} />
                          {b}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Account Number</label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit account number"
              className="w-full h-10 rounded-lg bg-secondary border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Account Name</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Name on your bank account"
              className="w-full h-10 rounded-lg bg-secondary border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <KeyRound className="w-3 h-3" /> FPC Code
            </label>
            <input
              type="text"
              value={fpcCode}
              onChange={(e) => setFpcCode(e.target.value.toUpperCase().slice(0, 20))}
              placeholder="FPC-XXXXXXXX"
              className="w-full h-10 rounded-lg bg-secondary border border-border px-3 text-sm font-mono tracking-wider text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[9px] text-muted-foreground mt-1">
              Don't have a code? <button type="button" onClick={() => navigate("/payment-receipt")} className="text-primary font-bold underline">View your receipts</button>
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-cta w-full h-11 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Withdrawal Request"}
        </button>

        {/* Previous Requests */}
        {pendingRequests.length > 0 && (
          <div className="mt-6">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Recent Requests</p>
            <div className="space-y-2">
              {pendingRequests.map((req) => (
                <div key={req.id} className="glass-card rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-foreground">₦{req.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${statusColor(req.status)}`}>{req.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default WithdrawRequest;
