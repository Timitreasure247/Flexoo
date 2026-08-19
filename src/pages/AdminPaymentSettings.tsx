import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Pencil, Trash2, Star, Check, X, Loader2, CreditCard, Lock, Upload, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PaymentAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  payment_method: string;
  qr_code: string | null;
  is_default: boolean;
  status: boolean;
  created_at: string;
  updated_at: string;
};

type AuditEntry = {
  id: string;
  payment_account_id: string | null;
  admin_id: string;
  admin_name: string | null;
  action: string;
  previous_values: any;
  new_values: any;
  created_at: string;
};

const METHODS = ["Bank Transfer", "Opay", "PalmPay", "Moniepoint", "Kuda", "Crypto", "Other"];

const empty = {
  bank_name: "",
  account_name: "",
  account_number: "",
  payment_method: "Bank Transfer",
  qr_code: "",
  is_default: false,
  status: true,
};

const AdminPaymentSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: accs }, { data: aud }] = await Promise.all([
      supabase.from("payment_accounts").select("*").order("is_default", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("payment_account_audit").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setAccounts((accs as PaymentAccount[]) || []);
    setAudit((aud as AuditEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  const startNew = () => {
    setForm({ ...empty });
    setEditingId("new");
  };

  const startEdit = (a: PaymentAccount) => {
    setForm({
      bank_name: a.bank_name,
      account_name: a.account_name,
      account_number: a.account_number,
      payment_method: a.payment_method,
      qr_code: a.qr_code || "",
      is_default: a.is_default,
      status: a.status,
    });
    setEditingId(a.id);
  };

  const handleUploadQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `qr-codes/${user.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file);
    if (error) {
      toast.error(error.message);
    } else {
      const { data } = supabase.storage.from("receipts").getPublicUrl(path);
      setForm((f) => ({ ...f, qr_code: data.publicUrl }));
      toast.success("QR code uploaded");
    }
    setUploading(false);
  };

  const save = async () => {
    if (!form.bank_name.trim() || !form.account_name.trim() || !form.account_number.trim()) {
      return toast.error("Fill in bank, name and number");
    }
    setBusy(true);
    if (editingId === "new") {
      const { error } = await supabase.rpc("admin_create_payment_account", {
        p_bank_name: form.bank_name.trim(),
        p_account_name: form.account_name.trim(),
        p_account_number: form.account_number.trim(),
        p_payment_method: form.payment_method,
        p_qr_code: form.qr_code,
        p_is_default: form.is_default,
        p_status: form.status,
      });
      if (error) toast.error(error.message);
      else toast.success("Payment account created");
    } else if (editingId) {
      const { error } = await supabase.rpc("admin_update_payment_account", {
        p_id: editingId,
        p_bank_name: form.bank_name.trim(),
        p_account_name: form.account_name.trim(),
        p_account_number: form.account_number.trim(),
        p_payment_method: form.payment_method,
        p_qr_code: form.qr_code,
        p_is_default: form.is_default,
        p_status: form.status,
      });
      if (error) toast.error(error.message);
      else toast.success("Updated");
    }
    setBusy(false);
    setEditingId(null);
    fetchAll();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this payment account?")) return;
    const { error } = await supabase.rpc("admin_delete_payment_account", { p_id: id });
    if (error) toast.error(error.message);
    else toast.success("Deleted");
    fetchAll();
  };

  const setDefault = async (id: string) => {
    const { error } = await supabase.rpc("admin_set_default_payment_account", { p_id: id });
    if (error) toast.error(error.message);
    else toast.success("Default updated");
    fetchAll();
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-8 text-center max-w-sm w-full">
          <Lock className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-lg font-bold text-foreground mb-2">Admins Only</h1>
          <p className="text-sm text-muted-foreground mb-6">You need an admin role to manage payment accounts.</p>
          <button onClick={() => navigate("/admin")} className="btn-cta w-full h-10 rounded-xl text-sm font-bold">Back to Admin</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-2xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate("/admin")} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <CreditCard className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h1 className="text-sm font-bold text-foreground">Payment Settings</h1>
            <p className="text-[10px] text-muted-foreground">Manage deposit accounts users see</p>
          </div>
          <button onClick={() => setShowAudit((s) => !s)} className="glass-card px-3 h-8 rounded-lg text-[10px] font-bold flex items-center gap-1 text-primary">
            <History className="w-3.5 h-3.5" /> Audit
          </button>
          <button onClick={startNew} className="btn-cta px-3 h-8 rounded-lg text-[11px] font-bold flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {editingId === "new" && (
              <EditCard form={form} setForm={setForm} onSave={save} onCancel={() => setEditingId(null)} busy={busy} uploading={uploading} onUpload={handleUploadQr} isNew />
            )}
            {accounts.length === 0 && editingId !== "new" && (
              <div className="glass-card rounded-xl p-8 text-center">
                <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No payment accounts yet. Click "Add" to create one.</p>
              </div>
            )}
            {accounts.map((a) =>
              editingId === a.id ? (
                <EditCard key={a.id} form={form} setForm={setForm} onSave={save} onCancel={() => setEditingId(null)} busy={busy} uploading={uploading} onUpload={handleUploadQr} />
              ) : (
                <div key={a.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-foreground">{a.bank_name}</p>
                      {a.is_default && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-400/15 text-emerald-400 flex items-center gap-1">
                          <Star className="w-2.5 h-2.5" /> Default
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${a.status ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {a.status ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {!a.is_default && (
                        <button onClick={() => setDefault(a.id)} title="Set default" className="w-7 h-7 rounded-md bg-emerald-400/10 hover:bg-emerald-400/20 flex items-center justify-center">
                          <Star className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                      )}
                      <button onClick={() => startEdit(a)} className="w-7 h-7 rounded-md bg-primary/10 hover:bg-primary/20 flex items-center justify-center">
                        <Pencil className="w-3 h-3 text-primary" />
                      </button>
                      <button onClick={() => remove(a.id)} className="w-7 h-7 rounded-md bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center">
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div><span className="text-muted-foreground">Method: </span><span className="text-foreground font-semibold">{a.payment_method}</span></div>
                    <div><span className="text-muted-foreground">Number: </span><span className="text-foreground font-mono font-semibold">{a.account_number}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Name: </span><span className="text-foreground font-semibold">{a.account_name}</span></div>
                  </div>
                  {a.qr_code && (
                    <img src={a.qr_code} alt="QR code" className="mt-3 w-24 h-24 rounded-lg object-cover border border-border" />
                  )}
                </div>
              )
            )}
          </div>
        )}

        {showAudit && (
          <div className="mt-6">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Audit Log (last 50)</p>
            <div className="space-y-1.5">
              {audit.length === 0 && <p className="text-xs text-muted-foreground">No audit entries yet.</p>}
              {audit.map((e) => (
                <div key={e.id} className="glass-card rounded-lg p-2.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{e.admin_name || e.admin_id.slice(0, 8)}</span>
                    <span className="text-muted-foreground text-[10px]">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-primary font-semibold uppercase text-[10px] mt-0.5">{e.action}</p>
                  {e.previous_values && (
                    <details className="mt-1 text-[10px] text-muted-foreground">
                      <summary className="cursor-pointer">Previous values</summary>
                      <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(e.previous_values, null, 2)}</pre>
                    </details>
                  )}
                  {e.new_values && (
                    <details className="mt-1 text-[10px] text-muted-foreground">
                      <summary className="cursor-pointer">New values</summary>
                      <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(e.new_values, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const EditCard = ({
  form, setForm, onSave, onCancel, busy, uploading, onUpload, isNew,
}: {
  form: any; setForm: (f: any) => void; onSave: () => void; onCancel: () => void;
  busy: boolean; uploading: boolean; onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; isNew?: boolean;
}) => (
  <div className="glass-card rounded-xl p-4 border border-primary/30">
    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">{isNew ? "New Account" : "Edit Account"}</p>
    <div className="grid grid-cols-2 gap-2">
      <Field label="Bank name" value={form.bank_name} onChange={(v) => setForm({ ...form, bank_name: v })} />
      <Field label="Method" value={form.payment_method} onChange={(v) => setForm({ ...form, payment_method: v })} type="select" options={METHODS} />
      <Field label="Account name" value={form.account_name} onChange={(v) => setForm({ ...form, account_name: v })} full />
      <Field label="Account number" value={form.account_number} onChange={(v) => setForm({ ...form, account_number: v })} full />
    </div>

    <div className="mt-3">
      <label className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">QR Code (optional)</label>
      <div className="flex items-center gap-3 mt-1">
        {form.qr_code && <img src={form.qr_code} alt="QR" className="w-16 h-16 rounded-lg object-cover border border-border" />}
        <label className="flex-1 cursor-pointer glass-card rounded-lg h-10 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "Uploading..." : form.qr_code ? "Replace QR" : "Upload QR"}
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
        </label>
        {form.qr_code && (
          <button onClick={() => setForm({ ...form, qr_code: "" })} className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-destructive" />
          </button>
        )}
      </div>
    </div>

    <div className="flex items-center gap-4 mt-3">
      <label className="flex items-center gap-2 text-[11px] font-semibold text-foreground cursor-pointer">
        <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="accent-emerald-500" />
        Set as default
      </label>
      <label className="flex items-center gap-2 text-[11px] font-semibold text-foreground cursor-pointer">
        <input type="checkbox" checked={form.status} onChange={(e) => setForm({ ...form, status: e.target.checked })} className="accent-emerald-500" />
        Active
      </label>
    </div>

    <div className="flex gap-2 mt-4">
      <button onClick={onSave} disabled={busy} className="btn-cta flex-1 h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
      </button>
      <button onClick={onCancel} className="glass-card flex-1 h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
        <X className="w-3.5 h-3.5" /> Cancel
      </button>
    </div>
  </div>
);

const Field = ({ label, value, onChange, type, options, full }: { label: string; value: string; onChange: (v: string) => void; type?: string; options?: string[]; full?: boolean; }) => (
  <div className={full ? "col-span-2" : ""}>
    <label className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">{label}</label>
    {type === "select" ? (
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30 bg-background">
        {options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : (
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full mt-0.5 glass-card rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30" />
    )}
  </div>
);

export default AdminPaymentSettings;
