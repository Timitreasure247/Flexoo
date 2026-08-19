import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, ExternalLink, Send, Instagram, Facebook, Twitter, Youtube, Music2, Globe, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

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

const platformIcon = (p: string) => {
  switch (p) {
    case "telegram": return Send;
    case "whatsapp": return MessageCircle;
    case "instagram": return Instagram;
    case "facebook": return Facebook;
    case "x": return Twitter;
    case "youtube": return Youtube;
    case "tiktok": return Music2;
    case "discord": return MessageCircle;
    default: return Globe;
  }
};

const Channel = () => {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("community_channels")
        .select("*")
        .eq("status", "active")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      setChannels((data as Channel[]) || []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("community-channels")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_channels" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md mx-auto px-4 pt-4"
      >
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/main")} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="text-sm font-bold text-foreground">Community Channels</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : channels.length === 0 ? (
          <p className="text-center text-[11px] text-muted-foreground py-10">No channels available.</p>
        ) : (
          <div className="space-y-2.5">
            {channels.map((c) => {
              const Icon = platformIcon(c.platform);
              return (
                <a
                  key={c.id}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {c.icon ? (
                      <img src={c.icon} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Icon className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-foreground truncate">{c.name}</p>
                    {c.description && <p className="text-[10px] text-muted-foreground truncate">{c.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {c.member_count && <p className="text-[10px] font-bold text-primary">{c.member_count}</p>}
                    <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Channel;
