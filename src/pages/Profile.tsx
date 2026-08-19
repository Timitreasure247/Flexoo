import { useState, useEffect } from "react";
import { ArrowLeft, User, Mail, Phone, Shield, Trophy, Wallet, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const LEVEL_ICONS: Record<string, string> = { bronze: "🥉", silver: "🥈", gold: "🥇" };

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  const initials = profile?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  const levelIcon = LEVEL_ICONS[profile?.level] || "🥉";

  const fields = [
    { icon: User, label: "Full Name", value: profile?.full_name || "—" },
    { icon: Mail, label: "Email", value: user?.email || "—" },
    { icon: Phone, label: "Phone", value: profile?.phone || "—" },
    { icon: Trophy, label: "Level", value: `${levelIcon} ${(profile?.level || "bronze").charAt(0).toUpperCase() + (profile?.level || "bronze").slice(1)}` },
    { icon: Wallet, label: "Balance", value: `₦${(profile?.bonus_balance || 0).toLocaleString()}` },
    { icon: Calendar, label: "Tasks Completed", value: `${profile?.total_tasks_completed || 0}` },
    { icon: Shield, label: "Account Status", value: "Verified" },
  ];

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-md mx-auto px-4 pt-4"
      >
        <motion.div variants={item} className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/main")} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="text-sm font-bold text-foreground">Profile</h1>
        </motion.div>

        <motion.div variants={item} className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary mb-2 shadow-[0_0_20px_hsla(85,80%,50%,0.1)]">
            {initials}
          </div>
          <p className="text-sm font-bold text-foreground">{profile?.full_name || "User"}</p>
          <p className="text-[10px] text-muted-foreground">@{profile?.username || "user"} • Member since {memberSince}</p>
        </motion.div>

        <div className="space-y-2">
          {fields.map(({ icon: Icon, label, value }) => (
            <motion.div key={label} variants={item} className="glass-card rounded-lg p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
                <p className="text-[12px] font-bold text-foreground">{value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Referral Code */}
        <motion.div variants={item} className="glass-card rounded-xl p-4 mt-4">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Referral Code</p>
          <p className="text-lg font-extrabold text-primary font-mono-app tracking-widest">{profile?.referral_code || "—"}</p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Profile;
