import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Users2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { toast } from "sonner";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  platform: string;
  url: string;
  icon: string | null;
  member_count: string | null;
  status: string;
  display_order: number;
}

const PLATFORMS = ["telegram", "whatsapp", "instagram", "facebook", "x", "tiktok", "youtube", "discord", "custom"];

const empty: Omit<Channel, "id"> = {
  name: "",
  description: "",
  platform: "telegram",
  url: "",
  icon: "",
  member_count: "",
  status: "active",
  display_order: 0,
};

const AdminCommunityChannels = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [form, setForm] = useState<Omit<Channel, "id">>(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("community_channels")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    setChannels((data as Channel[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, display_order: channels.length });
    setShowForm(true);
  };

  const openEdit = (c: Channel) => {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description || "",
      platform: c.platform,
      url: c.url,
      icon: c.icon || "",
      member_count: c.member_count || "",
      status: c.status,
      display_order: c.display_order,
    });
    setShowForm(true);
  };

  const validateUrl = (u: string) => {
    try {
      const url = new URL(u);
      return ["http:", "https:", "tg:"].includes(url.protocol);
    } catch {
      return false;
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    if (!form.url.trim() || !validateUrl(form.url.trim())) return toast.error("Valid URL required");
    setSaving(true);
    const payload = {
      ...form,
      name: form.name.trim(),
      url: form.url.trim(),
      description: form.description?.trim() || null,
      icon: form.icon?.trim() || null,
      member_count: form.member_count?.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("community_channels").update(payload).eq("id", editing.id)
      : await supabase.from("community_channels").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Channel updated" : "Channel added");
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this channel?")) return;
    const { error } = await supabase.from("community_channels").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const toggleStatus = async (c: Channel) => {
    const next = c.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("community_channels").update({ status: next }).eq("id", c.id);
    if (error) return toast.error(error.message);
    load();
  };

  const move = async (c: Channel, dir: -1 | 1) => {
    const idx = channels.findIndex((x) => x.id === c.id);
    const swap = channels[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("community_channels").update({ display_order: swap.display_order }).eq("id", c.id),
      supabase.from("community_channels").update({ display_order: c.display_order }).eq("id", swap.id),
    ]);
    load();
  };

  if (adminLoading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Admins only.
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate("/admin")} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="text-sm font-bold text-foreground">Community Channels</h1>
          <button onClick={openNew} className="ml-auto btn-cta px-3 h-8 rounded-lg text-[10px] font-bold flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : channels.length === 0 ? (
          <p className="text-center text-[11px] text-muted-foreground py-10">No channels yet.</p>
        ) : (
          <div className="space-y-2">
            {channels.map((c, i) => (
              <div key={c.id} className="glass-card rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.platform} · {c.url}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${c.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {c.status}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <button onClick={() => move(c, -1)} disabled={i === 0} className="text-[10px] px-2 py-1 glass-card rounded disabled:opacity-30">↑</button>
                  <button onClick={() => move(c, 1)} disabled={i === channels.length - 1} className="text-[10px] px-2 py-1 glass-card rounded disabled:opacity-30">↓</button>
                  <button onClick={() => toggleStatus(c)} className="text-[10px] px-2 py-1 glass-card rounded">
                    {c.status === "active" ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => openEdit(c)} className="ml-auto text-[10px] px-2 py-1 glass-card rounded flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => remove(c.id)} className="text-[10px] px-2 py-1 rounded bg-destructive/10 text-destructive flex items-center gap-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
            <div className="glass-card rounded-2xl p-4 w-full max-w-sm space-y-2" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-[13px] font-bold mb-2">{editing ? "Edit" : "New"} Channel</h2>
              <input className="w-full h-9 px-3 rounded-lg bg-muted/30 text-[11px]" placeholder="Name"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="w-full h-9 px-3 rounded-lg bg-muted/30 text-[11px]" placeholder="Description"
                value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <select className="w-full h-9 px-3 rounded-lg bg-muted/30 text-[11px]"
                value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input className="w-full h-9 px-3 rounded-lg bg-muted/30 text-[11px]" placeholder="URL (https://…)"
                value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <input className="w-full h-9 px-3 rounded-lg bg-muted/30 text-[11px]" placeholder="Icon URL (optional)"
                value={form.icon || ""} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
              <input className="w-full h-9 px-3 rounded-lg bg-muted/30 text-[11px]" placeholder="Member count e.g. 12.5K"
                value={form.member_count || ""} onChange={(e) => setForm({ ...form, member_count: e.target.value })} />
              <select className="w-full h-9 px-3 rounded-lg bg-muted/30 text-[11px]"
                value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 h-9 rounded-lg glass-card text-[11px] font-bold">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 h-9 rounded-lg btn-cta text-[11px] font-bold">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminCommunityChannels;
