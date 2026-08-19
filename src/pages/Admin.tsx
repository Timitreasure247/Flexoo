import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, CheckCircle, XCircle, Clock, RefreshCw, Lock, Image, CreditCard, Users, BarChart3, User, TrendingUp, Wallet, Activity, Download, Pencil, Save, X, Ticket, Copy, Trash2, RotateCcw, Plus, Settings as SettingsIcon, MessageCircle, Send, Mail, Phone, Video, Wallet as WalletIcon, Link as LinkIcon, Play, Landmark, FileText, Gift, Trophy, ToggleLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { ReceiptImage } from "@/components/ReceiptImage";

const uuidSchema = z.string().uuid({ message: "Must be a valid UUID" });
const fpcCodeSchema = z.object({
  user_id: uuidSchema,
  payment_id: uuidSchema,
  code: z
    .string()
    .trim()
    .regex(/^FPC-[A-Z0-9]{6,16}$/, { message: "Code must look like FPC-XXXXXXXX (uppercase letters/digits)" })
    .max(32),
});

const paymentEditSchema = z.object({
  amount: z.number().positive({ message: "Amount must be positive" }).max(10_000_000, { message: "Amount too large" }),
  status: z.enum(["pending", "confirmed", "rejected"]),
  receipt_url: z.string().trim().url({ message: "Must be a valid URL" }).max(500).or(z.literal("")),
});

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  bvn: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

interface PaymentRecord {
  id: string;
  user_id: string;
  amount: number;
  receipt_url: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  phone: string | null;
  bonus_balance: number;
  level: string;
  referral_code: string | null;
  total_tasks_completed: number;
  created_at: string;
}

interface FpcCode {
  id: string;
  user_id: string;
  payment_id: string;
  code: string;
  used: boolean;
  used_at: string | null;
  used_for_withdrawal_id: string | null;
  created_at: string;
}

type TabType = "analytics" | "withdrawals" | "payments" | "users" | "fpc" | "ads" | "settings";

interface AdRow { id: string; title: string; reward: number; video_url: string; daily_limit: number; active: boolean; }

const SETTING_KEYS = [
  "whatsapp_url","telegram_url","support_email","support_phone","ad_video_ids",
  "withdrawal_code_price","pay_with_transfer_link",
  "bank_name","account_name","account_number","payment_instructions",
  "referral_reward","referral_goal","free_code_enabled",
  "milestone_10_reward","milestone_25_reward","milestone_50_reward",
] as const;
type SettingKey = typeof SETTING_KEYS[number];

const exportToCSV = (rows: Record<string, unknown>[], filename: string) => {
  if (!rows.length) return toast.error("No data to export");
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exported!");
};

const Admin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminCheck();
  const [tab, setTab] = useState<TabType>("analytics");
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [fpcCodes, setFpcCodes] = useState<FpcCode[]>([]);
  const [settings, setSettings] = useState<Record<SettingKey, string>>({
    whatsapp_url: "",
    telegram_url: "",
    support_email: "",
    support_phone: "",
    ad_video_ids: "",
    withdrawal_code_price: "",
    pay_with_transfer_link: "",
    bank_name: "",
    account_name: "",
    account_number: "",
    payment_instructions: "",
    referral_reward: "",
    referral_goal: "",
    free_code_enabled: "true",
    milestone_10_reward: "",
    milestone_25_reward: "",
    milestone_50_reward: "",
  });
  const [savingSetting, setSavingSetting] = useState<SettingKey | null>(null);
  const [fpcFilter, setFpcFilter] = useState<"all" | "unused" | "used">("all");
  const [fpcSearch, setFpcSearch] = useState("");
  const [showFpcCreate, setShowFpcCreate] = useState(false);
  const [newFpcUserId, setNewFpcUserId] = useState("");
  const [newFpcPaymentId, setNewFpcPaymentId] = useState("");
  const [newFpcCode, setNewFpcCode] = useState("");
  const [newFpcConfirm, setNewFpcConfirm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editPayAmount, setEditPayAmount] = useState("");
  const [editPayStatus, setEditPayStatus] = useState<"pending" | "confirmed" | "rejected">("pending");
  const [editPayReceiptUrl, setEditPayReceiptUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [receiptModal, setReceiptModal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [editingWithdrawal, setEditingWithdrawal] = useState<string | null>(null);
  const [editBank, setEditBank] = useState("");
  const [editAccNum, setEditAccNum] = useState("");
  const [editAccName, setEditAccName] = useState("");

  // Ads state
  const [ads, setAds] = useState<AdRow[]>([]);
  const [adDraft, setAdDraft] = useState<AdRow>({ id: "", title: "", reward: 200, video_url: "", daily_limit: 1, active: true });

  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalUsers: 0,
    totalWithdrawals: 0,
    totalPayments: 0,
    totalTasks: 0,
    pendingWithdrawals: 0,
    pendingPayments: 0,
    totalWithdrawnAmount: 0,
    totalPaidAmount: 0,
    totalBalance: 0,
    todaySignups: 0,
  });

  const fetchAnalytics = async () => {
    const [profilesRes, withdrawalsRes, paymentsRes, tasksRes] = await Promise.all([
      supabase.from("profiles").select("bonus_balance, created_at"),
      supabase.from("withdrawal_requests").select("amount, status"),
      supabase.from("payments").select("amount, status"),
      supabase.from("daily_tasks").select("id"),
    ]);

    const profiles = profilesRes.data || [];
    const withdrawals = withdrawalsRes.data || [];
    const allPayments = paymentsRes.data || [];
    const tasks = tasksRes.data || [];

    const today = new Date().toISOString().split("T")[0];

    setAnalytics({
      totalUsers: profiles.length,
      totalWithdrawals: withdrawals.length,
      totalPayments: allPayments.length,
      totalTasks: tasks.length,
      pendingWithdrawals: withdrawals.filter((w) => w.status === "pending").length,
      pendingPayments: allPayments.filter((p) => p.status === "pending").length,
      totalWithdrawnAmount: withdrawals.filter((w) => w.status === "approved").reduce((s, w) => s + Number(w.amount), 0),
      totalPaidAmount: allPayments.filter((p) => p.status === "confirmed").reduce((s, p) => s + Number(p.amount), 0),
      totalBalance: profiles.reduce((s, p) => s + Number(p.bonus_balance), 0),
      todaySignups: profiles.filter((p) => p.created_at?.startsWith(today)).length,
    });
  };

  const fetchData = async () => {
    setLoading(true);
    if (tab === "analytics") {
      await fetchAnalytics();
    } else if (tab === "withdrawals") {
      let query = supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false });
      if (filter !== "all") query = query.eq("status", filter);
      const { data } = await query;
      setRequests(data || []);
    } else if (tab === "payments") {
      let query = supabase.from("payments").select("*").order("created_at", { ascending: false });
      if (filter !== "all") query = query.eq("status", filter);
      const { data } = await query;
      setPayments((data as PaymentRecord[]) || []);
    } else if (tab === "users") {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      setUsers((data as UserProfile[]) || []);
    } else if (tab === "fpc") {
      const { data } = await supabase.from("fpc_codes").select("*").order("created_at", { ascending: false });
      setFpcCodes((data as FpcCode[]) || []);
    } else if (tab === "ads") {
      const { data } = await supabase.from("ads").select("*").order("created_at", { ascending: false });
      setAds((data as AdRow[]) || []);
    } else if (tab === "settings") {
      const { data } = await supabase.from("app_settings").select("key, value");
      const next = { ...settings };
      (data || []).forEach((row: { key: string; value: string | null }) => {
        if ((SETTING_KEYS as readonly string[]).includes(row.key)) {
          next[row.key as SettingKey] = row.value ?? "";
        }
      });
      setSettings(next);
    }
    setLoading(false);
  };

  const handleSaveSetting = async (key: SettingKey) => {
    // Client-side validation for payment settings
    if (key === "withdrawal_code_price") {
      const n = Number(settings[key]);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Price must be a positive number");
        return;
      }
    }
    if (key === "pay_with_transfer_link") {
      const v = settings[key].trim();
      if (v) {
        try { new URL(v); } catch { toast.error("Enter a valid URL"); return; }
      }
    }
    setSavingSetting(key);
    const { error } = await supabase.rpc("admin_update_setting", {
      p_key: key,
      p_value: settings[key],
    });
    if (error) toast.error(error.message);
    else toast.success("Setting saved!");
    setSavingSetting(null);
  };

  useEffect(() => { fetchData(); }, [filter, tab]);

  // All admin mutations go through SECURITY DEFINER RPCs which re-verify the
  // admin role server-side. Direct table writes are no longer used.

  const handleWithdrawalAction = async (id: string, action: "approved" | "rejected") => {
    let reason: string | null = null;
    if (action === "rejected") {
      const input = window.prompt("Reason for rejection (shown to the user):", "");
      if (input === null) return; // cancelled
      reason = input.trim();
      if (!reason) {
        toast.error("A rejection reason is required");
        return;
      }
    }
    setProcessing(id);
    const { error } = await supabase.rpc("admin_update_withdrawal", {
      withdrawal_id: id,
      new_status: action,
      admin_user_id: user?.id || "",
      reason,
    });
    if (error) toast.error(error.message || "Failed to process request");
    else toast.success(`Request ${action}!`);
    setProcessing(null);
    fetchData();
  };

  const handlePaymentAction = async (id: string, action: "confirmed" | "rejected") => {
    setProcessing(id);
    const { error } = await supabase.rpc("admin_update_payment_status", {
      p_id: id,
      p_status: action,
    });
    if (error) toast.error(error.message || "Failed to process");
    else toast.success(`Payment ${action}!`);
    setProcessing(null);
    fetchData();
  };

  const handleSavePayment = async (p: PaymentRecord) => {
    const parsed = paymentEditSchema.safeParse({
      amount: Number(editPayAmount),
      status: editPayStatus,
      receipt_url: editPayReceiptUrl.trim(),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid payment data");
      return;
    }
    setProcessing(p.id);
    const { error } = await supabase.rpc("admin_update_payment", {
      p_id: p.id,
      p_amount: parsed.data.amount,
      p_status: parsed.data.status,
      p_receipt_url: parsed.data.receipt_url || "",
    });
    if (error) toast.error(error.message);
    else toast.success("Payment updated!");
    setEditingPayment(null);
    setProcessing(null);
    fetchData();
  };

  const handleSaveUser = async (u: UserProfile) => {
    setProcessing(u.id);
    const { error } = await supabase.rpc("admin_update_user_profile", {
      p_profile_id: u.id,
      p_balance: Number(editBalance),
      p_level: editLevel,
    });
    if (error) toast.error(error.message);
    else toast.success("User updated!");
    setEditingUser(null);
    setProcessing(null);
    fetchData();
  };

  const handleSaveWithdrawalAccount = async (req: WithdrawalRequest) => {
    setProcessing(req.id);
    const { error } = await supabase.rpc("admin_update_withdrawal_account", {
      p_id: req.id,
      p_bank: editBank,
      p_account_number: editAccNum,
      p_account_name: editAccName,
    });
    if (error) toast.error(error.message);
    else toast.success("Account details updated!");
    setEditingWithdrawal(null);
    setProcessing(null);
    fetchData();
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`);
  };

  const handleToggleCodeUsed = async (c: FpcCode) => {
    setProcessing(c.id);
    const { error } = await supabase.rpc("admin_toggle_fpc_used", {
      p_id: c.id,
      p_used: !c.used,
    });
    if (error) toast.error(error.message);
    else toast.success(`Code marked as ${!c.used ? "used" : "unused"}`);
    setProcessing(null);
    fetchData();
  };

  const handleRegenerateCode = async (c: FpcCode) => {
    if (!confirm(`Regenerate code for payment ${c.payment_id.slice(0, 8)}? Old code "${c.code}" will be deleted.`)) return;
    setProcessing(c.id);
    const { data, error } = await supabase.rpc("admin_regenerate_fpc_code", { p_id: c.id });
    if (error) toast.error(error.message);
    else toast.success(`New code: ${data}`);
    setProcessing(null);
    fetchData();
  };

  const handleDeleteCode = async (c: FpcCode) => {
    if (!confirm(`Delete code "${c.code}" permanently?`)) return;
    setProcessing(c.id);
    const { error } = await supabase.rpc("admin_delete_fpc_code", { p_id: c.id });
    if (error) toast.error(error.message);
    else toast.success("Code deleted");
    setProcessing(null);
    fetchData();
  };

  const handleAutoFillCode = async () => {
    const { data, error } = await supabase.rpc("generate_fpc_code");
    if (error || !data) return toast.error(error?.message || "Failed to generate");
    setNewFpcCode(data as string);
  };

  const handleCreateFpcCode = async () => {
    const parsed = fpcCodeSchema.safeParse({
      user_id: newFpcUserId.trim(),
      payment_id: newFpcPaymentId.trim(),
      code: newFpcCode.trim().toUpperCase(),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    if (!newFpcConfirm) {
      toast.error("Please confirm before creating");
      return;
    }

    setProcessing("create-fpc");
    const { error } = await supabase.rpc("admin_create_fpc_code", {
      p_user_id: parsed.data.user_id,
      p_payment_id: parsed.data.payment_id,
      p_code: parsed.data.code,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Code ${parsed.data.code} created!`);
      setNewFpcUserId("");
      setNewFpcPaymentId("");
      setNewFpcCode("");
      setNewFpcConfirm(false);
      setShowFpcCreate(false);
    }
    setProcessing(null);
    fetchData();
  };

  const statusIcon = (s: string) => {
    if (s === "pending") return <Clock className="w-3.5 h-3.5 text-yellow-400" />;
    if (s === "approved" || s === "confirmed") return <CheckCircle className="w-3.5 h-3.5 text-primary" />;
    return <XCircle className="w-3.5 h-3.5 text-destructive" />;
  };

  const statusColor = (s: string) =>
    s === "pending" ? "text-yellow-400 bg-yellow-400/10" : (s === "approved" || s === "confirmed") ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10";

  const filters = ["all", "pending", "approved", "rejected"] as const;

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery))
  );

  const filteredFpcCodes = fpcCodes.filter((c) => {
    if (fpcFilter === "used" && !c.used) return false;
    if (fpcFilter === "unused" && c.used) return false;
    if (!fpcSearch) return true;
    const q = fpcSearch.toLowerCase();
    return c.code.toLowerCase().includes(q) || c.user_id.toLowerCase().includes(q) || c.payment_id.toLowerCase().includes(q);
  });

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-8 text-center max-w-sm w-full">
          <Lock className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-lg font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-sm text-muted-foreground mb-6">You don't have admin privileges to access this panel.</p>
          <button onClick={() => navigate(user ? "/main" : "/admin-login")} className="btn-cta w-full h-10 rounded-xl text-sm font-bold">
            {user ? "Go to Dashboard" : "Admin Login"}
          </button>
        </motion.div>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "analytics", label: "Analytics", icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { key: "withdrawals", label: "Withdrawals", icon: <CreditCard className="w-3.5 h-3.5" /> },
    { key: "payments", label: "Payments", icon: <Image className="w-3.5 h-3.5" /> },
    { key: "users", label: "Users", icon: <Users className="w-3.5 h-3.5" /> },
    { key: "fpc", label: "FPC Codes", icon: <Ticket className="w-3.5 h-3.5" /> },
    { key: "ads", label: "Ads", icon: <Play className="w-3.5 h-3.5" /> },
    { key: "settings", label: "Settings", icon: <SettingsIcon className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-2xl mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate("/main")} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <Shield className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-sm font-bold text-foreground">Admin Panel</h1>
            <p className="text-[10px] text-muted-foreground">Manage requests, payments & users</p>
          </div>
          <button onClick={() => navigate("/admin/payment-settings")} title="Payment Settings" className="ml-auto glass-card px-2.5 h-8 rounded-lg flex items-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10">
            <CreditCard className="w-3.5 h-3.5" /> Payments
          </button>
          <button onClick={() => navigate("/admin/community-channels")} title="Community Channels" className="glass-card px-2.5 h-8 rounded-lg flex items-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10">
            Channels
          </button>
          <button onClick={fetchData} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/30">
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key === "withdrawals" || t.key === "payments") setFilter("pending"); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                tab === t.key ? "bg-primary/15 text-primary border border-primary/30" : "glass-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Analytics Tab */}
        {tab === "analytics" && (
          loading ? (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Overview Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Total Users", value: analytics.totalUsers, icon: <Users className="w-4 h-4 text-primary" />, color: "text-primary" },
                  { label: "Today's Signups", value: analytics.todaySignups, icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, color: "text-emerald-400" },
                  { label: "Total Tasks Done", value: analytics.totalTasks, icon: <Activity className="w-4 h-4 text-blue-400" />, color: "text-blue-400" },
                  { label: "Total Balance (All)", value: `₦${analytics.totalBalance.toLocaleString()}`, icon: <Wallet className="w-4 h-4 text-amber-400" />, color: "text-amber-400" },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="glass-card rounded-xl p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      {icon}
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">{label}</p>
                    </div>
                    <p className={`text-lg font-extrabold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Financial Summary */}
              <div className="glass-card rounded-xl p-4">
                <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Financial Summary
                </h3>
                <div className="space-y-2.5">
                  {[
                    { label: "Total Withdrawn (Approved)", value: `₦${analytics.totalWithdrawnAmount.toLocaleString()}`, sub: `${analytics.totalWithdrawals} total requests` },
                    { label: "Total Payments (Confirmed)", value: `₦${analytics.totalPaidAmount.toLocaleString()}`, sub: `${analytics.totalPayments} total payments` },
                    { label: "Pending Withdrawals", value: analytics.pendingWithdrawals, sub: "awaiting review" },
                    { label: "Pending Payments", value: analytics.pendingPayments, sub: "awaiting confirmation" },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="inner-card rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-foreground">{label}</p>
                        <p className="text-[9px] text-muted-foreground">{sub}</p>
                      </div>
                      <p className="text-sm font-extrabold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}

        {/* Filter Tabs (for withdrawals & payments) */}
        {(tab === "withdrawals" || tab === "payments") && (
          <div className="flex items-center gap-1.5 mb-4">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                  filter === f ? "bg-primary/15 text-primary border border-primary/30" : "glass-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
            <button
              onClick={() =>
                tab === "withdrawals"
                  ? exportToCSV(requests.map(({ id, amount, bank_name, account_number, account_name, bvn, status, created_at }) => ({ id, amount, bank_name, account_number, account_name, bvn, status, created_at })), "withdrawals")
                  : exportToCSV(payments.map(({ id, amount, status, created_at, user_id }) => ({ id, amount, status, created_at, user_id })), "payments")
              }
              className="ml-auto glass-card px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 text-primary hover:bg-primary/10 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <>
            <input
              type="text"
              placeholder="Search by name, username, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full glass-card rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground mb-4 outline-none focus:ring-1 focus:ring-primary/30"
            />
            {loading ? (
              <div className="text-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No users found</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">
                  {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
                </p>
                {filteredUsers.map((u) => (
                  <div key={u.id} className="glass-card rounded-xl p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] font-bold text-foreground truncate">{u.full_name || "—"}</p>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              u.level === "gold" ? "bg-amber-400/15 text-amber-400" :
                              u.level === "silver" ? "bg-gray-400/15 text-gray-400" :
                              "bg-orange-400/15 text-orange-400"
                            }`}>{u.level}</span>
                            {editingUser !== u.id && (
                              <button
                                onClick={() => { setEditingUser(u.id); setEditBalance(String(u.bonus_balance)); setEditLevel(u.level); }}
                                className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                              >
                                <Pencil className="w-3 h-3 text-primary" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">@{u.username} · {u.phone || "No phone"}</p>

                        {editingUser === u.id ? (
                          <div className="mt-2 space-y-2">
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase font-bold">Balance (₦)</label>
                              <input
                                type="number"
                                value={editBalance}
                                onChange={(e) => setEditBalance(e.target.value)}
                                className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase font-bold">Level</label>
                              <select
                                value={editLevel}
                                onChange={(e) => setEditLevel(e.target.value)}
                                className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30 bg-background"
                              >
                                <option value="bronze">Bronze</option>
                                <option value="silver">Silver</option>
                                <option value="gold">Gold</option>
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveUser(u)}
                                disabled={processing === u.id}
                                className="btn-cta flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                              >
                                <Save className="w-3 h-3" /> Save
                              </button>
                              <button
                                onClick={() => setEditingUser(null)}
                                className="glass-card flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <X className="w-3 h-3" /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[10px] text-primary font-bold">₦{Number(u.bonus_balance).toLocaleString()}</span>
                              <span className="text-[9px] text-muted-foreground">Tasks: {u.total_tasks_completed}</span>
                              <span className="text-[9px] text-muted-foreground">Code: {u.referral_code || "—"}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-1">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Withdrawals Content */}
        {tab === "withdrawals" && (
          loading ? (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No {filter !== "all" ? filter : ""} withdrawal requests</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {requests.map((req) => (
                <div key={req.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-base font-extrabold text-foreground">₦{req.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(req.status)}`}>
                      {statusIcon(req.status)} {req.status}
                    </span>
                  </div>
                  {editingWithdrawal === req.id ? (
                    <div className="space-y-2 mb-3">
                      <div>
                        <label className="text-[9px] text-muted-foreground uppercase font-bold">Bank Name</label>
                        <input value={editBank} onChange={(e) => setEditBank(e.target.value)} className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30" />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground uppercase font-bold">Account Number</label>
                        <input value={editAccNum} onChange={(e) => setEditAccNum(e.target.value)} className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30" />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground uppercase font-bold">Account Name</label>
                        <input value={editAccName} onChange={(e) => setEditAccName(e.target.value)} className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveWithdrawalAccount(req)} disabled={processing === req.id} className="btn-cta flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                          <Save className="w-3 h-3" /> Save
                        </button>
                        <button onClick={() => setEditingWithdrawal(null)} className="glass-card flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold">Account Details</span>
                        <button
                          onClick={() => { setEditingWithdrawal(req.id); setEditBank(req.bank_name); setEditAccNum(req.account_number); setEditAccName(req.account_name); }}
                          className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                        >
                          <Pencil className="w-3 h-3 text-primary" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Bank", value: req.bank_name },
                          { label: "Account No.", value: req.account_number },
                          { label: "Account Name", value: req.account_name },
                          { label: "BVN", value: req.bvn.slice(0, 3) + "****" + req.bvn.slice(-4) },
                        ].map(({ label, value }) => (
                          <div key={label} className="inner-card rounded-lg p-2">
                            <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">{label}</p>
                            <p className="text-[11px] font-bold text-foreground truncate">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleWithdrawalAction(req.id, "approved")}
                        disabled={processing === req.id}
                        className="btn-cta flex-1 h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleWithdrawalAction(req.id, "rejected")}
                        disabled={processing === req.id}
                        className="btn-danger flex-1 h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Payments Content */}
        {tab === "payments" && (
          loading ? (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <Image className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No {filter !== "all" ? filter : ""} payments</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {payments.map((pay) => (
                <div key={pay.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-base font-extrabold text-foreground">₦{pay.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(pay.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(pay.status)}`}>
                        {statusIcon(pay.status)} {pay.status}
                      </span>
                      {editingPayment !== pay.id && (
                        <button
                          onClick={() => {
                            setEditingPayment(pay.id);
                            setEditPayAmount(String(pay.amount));
                            setEditPayStatus(pay.status as "pending" | "confirmed" | "rejected");
                            setEditPayReceiptUrl(pay.receipt_url || "");
                          }}
                          className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                        >
                          <Pencil className="w-3 h-3 text-primary" />
                        </button>
                      )}
                    </div>
                  </div>

                  {editingPayment === pay.id ? (
                    <div className="space-y-2 mb-3">
                      <div>
                        <label className="text-[9px] text-muted-foreground uppercase font-bold">Amount (₦)</label>
                        <input
                          type="number"
                          value={editPayAmount}
                          onChange={(e) => setEditPayAmount(e.target.value)}
                          className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground uppercase font-bold">Status</label>
                        <select
                          value={editPayStatus}
                          onChange={(e) => setEditPayStatus(e.target.value as "pending" | "confirmed" | "rejected")}
                          className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30 bg-background"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground uppercase font-bold">Receipt URL</label>
                        <input
                          type="url"
                          value={editPayReceiptUrl}
                          onChange={(e) => setEditPayReceiptUrl(e.target.value)}
                          maxLength={500}
                          placeholder="https://..."
                          className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSavePayment(pay)}
                          disabled={processing === pay.id}
                          className="btn-cta flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Save className="w-3 h-3" /> Save
                        </button>
                        <button
                          onClick={() => setEditingPayment(null)}
                          className="glass-card flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {pay.receipt_url && (
                        <button
                          onClick={() => setReceiptModal(pay.receipt_url)}
                          className="w-full mb-3 inner-card rounded-xl p-3 flex items-center gap-3 hover:border-primary/30 transition-colors"
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary shrink-0">
                            <ReceiptImage receiptUrl={pay.receipt_url} className="w-full h-full" imgClassName="w-full h-full object-cover" />
                          </div>
                          <div className="text-left">
                            <p className="text-[11px] font-bold text-foreground">View Receipt</p>
                            <p className="text-[9px] text-muted-foreground">Tap to view full receipt image</p>
                          </div>
                          <Image className="w-4 h-4 text-muted-foreground ml-auto" />
                        </button>
                      )}
                      <p className="text-[9px] text-muted-foreground mb-2 font-mono-app truncate">User: {pay.user_id.slice(0, 8)}... · Payment: {pay.id.slice(0, 8)}...</p>
                    </>
                  )}

                  {pay.status === "pending" && editingPayment !== pay.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePaymentAction(pay.id, "confirmed")}
                        disabled={processing === pay.id}
                        className="btn-cta flex-1 h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Confirm
                      </button>
                      <button
                        onClick={() => handlePaymentAction(pay.id, "rejected")}
                        disabled={processing === pay.id}
                        className="btn-danger flex-1 h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* FPC Codes Tab */}
        {tab === "fpc" && (
          <>
            <div className="flex items-center gap-1.5 mb-3">
              {(["all", "unused", "used"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFpcFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                    fpcFilter === f ? "bg-primary/15 text-primary border border-primary/30" : "glass-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
              <button
                onClick={() => setShowFpcCreate((v) => !v)}
                className="ml-auto glass-card px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 text-primary hover:bg-primary/10 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> {showFpcCreate ? "Close" : "New"}
              </button>
              <button
                onClick={() => exportToCSV(fpcCodes.map(({ id, code, user_id, payment_id, used, used_at, created_at }) => ({ id, code, user_id, payment_id, used, used_at, created_at })), "fpc_codes")}
                className="glass-card px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 text-primary hover:bg-primary/10 transition-all"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>

            {showFpcCreate && (
              <div className="glass-card rounded-xl p-4 mb-4 space-y-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <Ticket className="w-4 h-4 text-primary" />
                  <p className="text-xs font-bold text-foreground">Create FPC Code Manually</p>
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase font-bold">User ID (UUID)</label>
                  <input
                    type="text"
                    value={newFpcUserId}
                    onChange={(e) => setNewFpcUserId(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    maxLength={36}
                    className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/30 font-mono-app"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase font-bold">Payment ID (UUID)</label>
                  <input
                    type="text"
                    value={newFpcPaymentId}
                    onChange={(e) => setNewFpcPaymentId(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    maxLength={36}
                    className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/30 font-mono-app"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase font-bold">FPC Code (FPC-XXXXXXXX)</label>
                  <div className="flex gap-2 mt-0.5">
                    <input
                      type="text"
                      value={newFpcCode}
                      onChange={(e) => setNewFpcCode(e.target.value.toUpperCase())}
                      placeholder="FPC-ABCD1234"
                      maxLength={32}
                      className="flex-1 glass-card rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/30 font-mono-app"
                    />
                    <button
                      onClick={handleAutoFillCode}
                      type="button"
                      className="glass-card px-3 rounded-lg text-[10px] font-bold text-primary hover:bg-primary/10"
                    >
                      Auto
                    </button>
                  </div>
                </div>
                <label className="flex items-start gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={newFpcConfirm}
                    onChange={(e) => setNewFpcConfirm(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-[10px] text-muted-foreground leading-snug">
                    I confirm the User ID and Payment ID are correct, and the user has paid for this code.
                  </span>
                </label>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleCreateFpcCode}
                    disabled={processing === "create-fpc" || !newFpcConfirm}
                    className="btn-cta flex-1 h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" /> Create Code
                  </button>
                  <button
                    onClick={() => { setShowFpcCreate(false); setNewFpcUserId(""); setNewFpcPaymentId(""); setNewFpcCode(""); setNewFpcConfirm(false); }}
                    className="glass-card flex-1 h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </div>
              </div>
            )}
            <input
              type="text"
              placeholder="Search by code, user id, or payment id..."
              value={fpcSearch}
              onChange={(e) => setFpcSearch(e.target.value)}
              className="w-full glass-card rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground mb-4 outline-none focus:ring-1 focus:ring-primary/30"
            />
            {loading ? (
              <div className="text-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              </div>
            ) : filteredFpcCodes.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <Ticket className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No FPC codes found</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">
                  {filteredFpcCodes.length} code{filteredFpcCodes.length !== 1 ? "s" : ""}
                </p>
                {filteredFpcCodes.map((c) => (
                  <div key={c.id} className="glass-card rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-primary" />
                        <p className="text-sm font-extrabold text-foreground font-mono-app">{c.code}</p>
                        <button
                          onClick={() => handleCopyCode(c.code)}
                          className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                        >
                          <Copy className="w-3 h-3 text-primary" />
                        </button>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        c.used ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                      }`}>
                        {c.used ? "Used" : "Unused"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="inner-card rounded-lg p-2">
                        <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">User ID</p>
                        <p className="text-[10px] font-bold text-foreground font-mono-app truncate">{c.user_id.slice(0, 12)}...</p>
                      </div>
                      <div className="inner-card rounded-lg p-2">
                        <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">Payment ID</p>
                        <p className="text-[10px] font-bold text-foreground font-mono-app truncate">{c.payment_id.slice(0, 12)}...</p>
                      </div>
                      <div className="inner-card rounded-lg p-2">
                        <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">Created</p>
                        <p className="text-[10px] font-bold text-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="inner-card rounded-lg p-2">
                        <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">Used At</p>
                        <p className="text-[10px] font-bold text-foreground">{c.used_at ? new Date(c.used_at).toLocaleDateString() : "—"}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleCodeUsed(c)}
                        disabled={processing === c.id}
                        className="glass-card flex-1 h-8 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 text-foreground hover:bg-muted/30 disabled:opacity-50"
                      >
                        {c.used ? <><RotateCcw className="w-3 h-3" /> Mark Unused</> : <><CheckCircle className="w-3 h-3" /> Mark Used</>}
                      </button>
                      <button
                        onClick={() => handleRegenerateCode(c)}
                        disabled={processing === c.id}
                        className="glass-card flex-1 h-8 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 text-primary hover:bg-primary/10 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" /> Regenerate
                      </button>
                      <button
                        onClick={() => handleDeleteCode(c)}
                        disabled={processing === c.id}
                        className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Settings Tab */}
        {tab === "settings" && (
          loading ? (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            </div>
          ) : (
            <div className="space-y-3">
              {([
                { key: "whatsapp_url" as SettingKey, label: "WhatsApp Support Link", icon: MessageCircle, placeholder: "https://wa.me/2348000000000" },
                { key: "telegram_url" as SettingKey, label: "Telegram Support Link", icon: Send, placeholder: "https://t.me/yourchannel" },
                { key: "support_email" as SettingKey, label: "Support Email", icon: Mail, placeholder: "support@flexoo.com" },
                { key: "support_phone" as SettingKey, label: "Support Phone", icon: Phone, placeholder: "+234 800 0000" },
                { key: "ad_video_ids" as SettingKey, label: "Ad Video YouTube IDs (comma-separated)", icon: Video, placeholder: "dQw4w9WgXcQ,9bZkp7q19f0" },
                { key: "withdrawal_code_price" as SettingKey, label: "Withdrawal Code Price (₦)", icon: WalletIcon, placeholder: "7500" },
                { key: "pay_with_transfer_link" as SettingKey, label: "Pay with Transfer Link", icon: LinkIcon, placeholder: "https://checkout.example.com/pay" },
                { key: "bank_name" as SettingKey, label: "Bank Name (Buy Code)", icon: Landmark, placeholder: "Moniepoint MFB" },
                { key: "account_name" as SettingKey, label: "Account Name (Buy Code)", icon: User, placeholder: "FLEXOO DIGITAL SERVICES" },
                { key: "account_number" as SettingKey, label: "Account Number (Buy Code)", icon: CreditCard, placeholder: "8137498802" },
                { key: "payment_instructions" as SettingKey, label: "Payment Instructions", icon: FileText, placeholder: "Transfer the exact amount…" },
                { key: "referral_reward" as SettingKey, label: "Referral Reward Amount (₦)", icon: Gift, placeholder: "5000" },
                { key: "referral_goal" as SettingKey, label: "Referrals Required for Free Code", icon: Trophy, placeholder: "50" },
                { key: "free_code_enabled" as SettingKey, label: "Free Withdrawal Code Enabled (true/false)", icon: ToggleLeft, placeholder: "true" },
                { key: "milestone_10_reward" as SettingKey, label: "Milestone Reward: 10 Referrals (₦)", icon: Trophy, placeholder: "2000" },
                { key: "milestone_25_reward" as SettingKey, label: "Milestone Reward: 25 Referrals (₦)", icon: Trophy, placeholder: "7500" },
                { key: "milestone_50_reward" as SettingKey, label: "Milestone Reward: 50 Referrals (₦)", icon: Trophy, placeholder: "25000" },
              ]).map(({ key, label, icon: Icon, placeholder }) => (
                <div key={key} className="glass-card rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-[11px] font-bold text-foreground">{label}</p>
                  </div>
                  {key === "ad_video_ids" || key === "payment_instructions" ? (
                    <textarea
                      value={settings[key]}
                      onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                      placeholder={placeholder}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                    />
                  ) : (
                    <input
                      type="text"
                      value={settings[key]}
                      onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                    />
                  )}
                  <button
                    onClick={() => handleSaveSetting(key)}
                    disabled={savingSetting === key}
                    className="btn-cta mt-3 w-full h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {savingSetting === key ? (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <><Save className="w-3 h-3" /> Save</>
                    )}
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground text-center pt-2">
                Settings update instantly across the app for all users.
              </p>
            </div>
          )
        )}

        {tab === "ads" && (
          <div className="space-y-3">
            <div className="glass-card rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <Play className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold text-foreground">{adDraft.id ? "Edit Ad" : "Create Ad"}</p>
              </div>
              <input value={adDraft.title} onChange={(e) => setAdDraft({ ...adDraft, title: e.target.value })} placeholder="Ad title" maxLength={120}
                className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-[12px] text-foreground focus:outline-none focus:border-primary" />
              <input value={adDraft.video_url} onChange={(e) => setAdDraft({ ...adDraft, video_url: e.target.value })} placeholder="YouTube URL or video ID"
                className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-[12px] text-foreground focus:outline-none focus:border-primary" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase font-bold">Reward (₦)</label>
                  <input type="number" min={0} value={adDraft.reward} onChange={(e) => setAdDraft({ ...adDraft, reward: Number(e.target.value) })}
                    className="w-full mt-0.5 px-3 py-2 rounded-lg bg-secondary/50 border border-border text-[12px] text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase font-bold">Daily Limit</label>
                  <input type="number" min={1} value={adDraft.daily_limit} onChange={(e) => setAdDraft({ ...adDraft, daily_limit: Number(e.target.value) })}
                    className="w-full mt-0.5 px-3 py-2 rounded-lg bg-secondary/50 border border-border text-[12px] text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={adDraft.active} onChange={(e) => setAdDraft({ ...adDraft, active: e.target.checked })} className="accent-primary" />
                <span className="text-[11px] text-foreground">Active (visible to users)</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={async () => {
                    if (!adDraft.title.trim() || !adDraft.video_url.trim()) { toast.error("Title and video URL required"); return; }
                    setProcessing("save-ad");
                    const { error } = await supabase.rpc("admin_upsert_ad", {
                      p_id: adDraft.id || null, p_title: adDraft.title.trim(), p_reward: adDraft.reward,
                      p_video_url: adDraft.video_url.trim(), p_daily_limit: adDraft.daily_limit, p_active: adDraft.active,
                    });
                    if (error) toast.error(error.message);
                    else { toast.success(adDraft.id ? "Ad updated" : "Ad created"); setAdDraft({ id: "", title: "", reward: 200, video_url: "", daily_limit: 1, active: true }); fetchData(); }
                    setProcessing(null);
                  }}
                  disabled={processing === "save-ad"}
                  className="btn-cta flex-1 h-9 rounded-lg text-[11px] flex items-center justify-center gap-1 disabled:opacity-50">
                  <Save className="w-3 h-3" /> {adDraft.id ? "Update Ad" : "Create Ad"}
                </button>
                {adDraft.id && (
                  <button onClick={() => setAdDraft({ id: "", title: "", reward: 200, video_url: "", daily_limit: 1, active: true })}
                    className="glass-card flex-1 h-9 rounded-lg text-[11px] font-bold text-muted-foreground">Cancel</button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : ads.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center"><Play className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No ads yet</p></div>
            ) : (
              <div className="space-y-2">
                {ads.map((a) => (
                  <div key={a.id} className="glass-card rounded-xl p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-foreground truncate">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.video_url}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${a.active ? "bg-primary/15 text-primary" : "bg-muted/30 text-muted-foreground"}`}>{a.active ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="inner-card rounded-lg p-2"><p className="text-[8px] uppercase text-muted-foreground font-bold">Reward</p><p className="text-[11px] font-bold text-primary">₦{Number(a.reward).toLocaleString()}</p></div>
                      <div className="inner-card rounded-lg p-2"><p className="text-[8px] uppercase text-muted-foreground font-bold">Daily Limit</p><p className="text-[11px] font-bold text-foreground">{a.daily_limit}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setAdDraft(a)} className="glass-card flex-1 h-8 rounded-lg text-[10px] font-bold text-primary flex items-center justify-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this ad?")) return;
                          setProcessing(a.id);
                          const { error } = await supabase.rpc("admin_delete_ad", { p_id: a.id });
                          if (error) toast.error(error.message); else { toast.success("Ad deleted"); fetchData(); }
                          setProcessing(null);
                        }}
                        disabled={processing === a.id}
                        className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive disabled:opacity-50">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Receipt Modal */}
      {receiptModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setReceiptModal(null)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-lg w-full max-h-[80vh] overflow-auto rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ReceiptImage receiptUrl={receiptModal} className="w-full min-h-[200px] rounded-2xl" imgClassName="w-full rounded-2xl" />
            <button
              onClick={() => setReceiptModal(null)}
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

export default Admin;
