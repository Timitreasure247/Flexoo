import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, Mail, Phone, ExternalLink, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const Support = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    whatsapp_url: "",
    telegram_url: "",
    support_email: "support@flexoo.com",
    support_phone: "+234 800 FLEXOO",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_public_settings" as any);
      const next = { ...settings };
      ((data as { key: string; value: string | null }[] | null) || []).forEach((row) => {
        if (row.key in next && row.value) (next as Record<string, string>)[row.key] = row.value;
      });
      setSettings(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const channels = [
    {
      icon: MessageCircle,
      label: "WhatsApp Support",
      desc: "Chat with our team on WhatsApp",
      action: "Open Chat",
      href: settings.whatsapp_url,
    },
    {
      icon: Send,
      label: "Telegram Support",
      desc: "Join our Telegram support",
      action: "Open Telegram",
      href: settings.telegram_url,
    },
    {
      icon: Mail,
      label: "Email Support",
      desc: settings.support_email,
      action: "Send Email",
      href: `mailto:${settings.support_email}`,
    },
    {
      icon: Phone,
      label: "Phone Support",
      desc: settings.support_phone,
      action: "Call Now",
      href: `tel:${settings.support_phone.replace(/\s+/g, "")}`,
    },
  ];

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
          <h1 className="text-sm font-bold text-foreground">Support</h1>
        </div>

        <div className="space-y-2.5">
          {channels.map(({ icon: Icon, label, desc, action, href }) => (
            <a
              key={label}
              href={href || "#"}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="glass-card rounded-xl p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
              </div>
              <span className="text-[10px] font-semibold text-primary flex items-center gap-1 shrink-0">
                {action} <ExternalLink className="w-3 h-3" />
              </span>
            </a>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Support;
