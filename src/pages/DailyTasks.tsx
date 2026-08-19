import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, Eye, Share2, Users, Flame, Trophy, X, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const DEFAULT_AD_VIDEOS = [
  "dQw4w9WgXcQ",
  "9bZkp7q19f0",
  "kJQP7kiw5Fk",
  "RgKAFK5djSk",
  "JGwWNGJdvx8",
];

const TASKS = [
  { type: "login", label: "Daily Login", desc: "Log in to the app today", icon: Flame, points: 100 },
  { type: "watch_ad", label: "Watch Video Ad", desc: "Watch a 30-second promotional video", icon: Eye, points: 200 },
  { type: "share", label: "Share on Social Media", desc: "Share your referral link on any platform", icon: Share2, points: 150 },
  { type: "invite", label: "Invite a Friend", desc: "Get a friend to sign up today", icon: Users, points: 500 },
];

const LEVELS = [
  { name: "Bronze", minTasks: 0, color: "hsl(30, 60%, 50%)", icon: "🥉" },
  { name: "Silver", minTasks: 20, color: "hsl(0, 0%, 70%)", icon: "🥈" },
  { name: "Gold", minTasks: 50, color: "hsl(45, 90%, 55%)", icon: "🥇" },
];

const DailyTasks = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  // Video ad state
  const [showVideoAd, setShowVideoAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(30);
  const [adPlaying, setAdPlaying] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState("");
  const [adVideos, setAdVideos] = useState<string[]>(DEFAULT_AD_VIDEOS);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchTasks = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [{ data: todayTasks }, { data: profile }] = await Promise.all([
        supabase.from("daily_tasks").select("task_type").eq("user_id", user.id).eq("completed_at", today),
        supabase.from("profiles").select("total_tasks_completed").eq("user_id", user.id).single(),
      ]);
      setCompletedTasks(todayTasks?.map((t) => t.task_type) || []);
      setTotalCompleted(profile?.total_tasks_completed || 0);
      setLoading(false);
    };
    fetchTasks();
  }, [user]);

  // Load admin-configured ad videos
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_public_settings" as any);
      const row = (data as { key: string; value: string | null }[] | null)?.find((r) => r.key === "ad_video_ids");
      const raw = row?.value || "";
      const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length) setAdVideos(ids);
    })();
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const currentLevel = [...LEVELS].reverse().find((l) => totalCompleted >= l.minTasks) || LEVELS[0];
  const nextLevel = LEVELS[LEVELS.indexOf(currentLevel) + 1];
  const progressToNext = nextLevel ? Math.min(100, ((totalCompleted - currentLevel.minTasks) / (nextLevel.minTasks - currentLevel.minTasks)) * 100) : 100;

  const recordTaskCompletion = async (taskType: string) => {
    if (!user) return;
    const task = TASKS.find((t) => t.type === taskType);
    if (!task) return;

    const { error } = await supabase.from("daily_tasks").insert({
      user_id: user.id,
      task_type: taskType,
      points_earned: task.points,
    });

    if (error) {
      if (error.code === "23505") toast.error("Task already completed today!");
      else toast.error("Something went wrong");
      return false;
    }

    // Update profile
    const { data: profileData } = await supabase.from("profiles").select("bonus_balance").eq("user_id", user.id).single();
    await supabase.from("profiles").update({
      bonus_balance: (profileData?.bonus_balance || 0) + task.points,
      total_tasks_completed: totalCompleted + 1,
    }).eq("user_id", user.id);

    // Check for level up
    const newTotal = totalCompleted + 1;
    const newLevel = [...LEVELS].reverse().find((l) => newTotal >= l.minTasks) || LEVELS[0];
    if (newLevel.name !== currentLevel.name) {
      await supabase.from("profiles").update({ level: newLevel.name.toLowerCase() }).eq("user_id", user.id);
      toast.success(`🎉 Level Up! You're now ${newLevel.icon} ${newLevel.name}!`);
    }

    setCompletedTasks((prev) => [...prev, taskType]);
    setTotalCompleted(newTotal);
    toast.success(`+₦${task.points} earned!`);
    return true;
  };

  const completeTask = async (taskType: string) => {
    if (!user || completedTasks.includes(taskType)) return;

    // For watch_ad, open the video modal
    if (taskType === "watch_ad") {
      setCurrentVideoId(adVideos[Math.floor(Math.random() * adVideos.length)]);
      setShowVideoAd(true);
      setAdCountdown(30);
      setAdPlaying(false);
      return;
    }

    // For share task, trigger share dialog
    if (taskType === "share") {
      const { data: profile } = await supabase.from("profiles").select("referral_code").eq("user_id", user.id).single();
      const shareData = {
        title: "Join Flexoo!",
        text: `Sign up on Flexoo with my referral code ${profile?.referral_code} and earn ₦170,000 bonus!`,
        url: `${window.location.origin}/signup?ref=${profile?.referral_code}`,
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch {
          return;
        }
      } else {
        navigator.clipboard.writeText(shareData.url);
        toast.success("Referral link copied!");
      }
    }

    await recordTaskCompletion(taskType);
  };

  // Start the video ad countdown
  const startVideoAd = () => {
    setAdPlaying(true);
    setAdCountdown(30);
    countdownRef.current = setInterval(() => {
      setAdCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          // Ad finished - complete the task
          setShowVideoAd(false);
          setAdPlaying(false);
          recordTaskCompletion("watch_ad");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Auto-complete login task
  useEffect(() => {
    if (!loading && user && !completedTasks.includes("login")) {
      recordTaskCompletion("login");
    }
  }, [loading, user]);

  const todayProgress = Math.round((completedTasks.length / TASKS.length) * 100);

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-md mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/earn-more")} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="text-sm font-bold text-foreground">Daily Tasks</h1>
          <div className="ml-auto glass-card px-3 py-1 rounded-full">
            <p className="text-[10px] font-bold text-primary">{completedTasks.length}/{TASKS.length} Done</p>
          </div>
        </div>

        {/* Level Card */}
        <div className="glass-card rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" style={{ color: currentLevel.color }} />
              <div>
                <p className="text-xs font-bold text-foreground">{currentLevel.icon} {currentLevel.name} Level</p>
                <p className="text-[10px] text-muted-foreground">{totalCompleted} tasks completed all-time</p>
              </div>
            </div>
            {nextLevel && (
              <p className="text-[10px] text-muted-foreground">
                Next: {nextLevel.icon} {nextLevel.name}
              </p>
            )}
          </div>
          <Progress value={progressToNext} className="h-2" />
          {nextLevel && (
            <p className="text-[9px] text-muted-foreground mt-1.5">
              {nextLevel.minTasks - totalCompleted} more tasks to level up
            </p>
          )}
        </div>

        {/* Today's Progress */}
        <div className="glass-card rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Today's Progress</p>
            <p className="text-[10px] font-bold text-primary">{todayProgress}%</p>
          </div>
          <Progress value={todayProgress} className="h-1.5" />
        </div>

        {/* Today's Tasks */}
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Today's Tasks</p>
        <div className="space-y-2.5">
          {TASKS.map(({ type, label, desc, icon: Icon, points }) => {
            const done = completedTasks.includes(type);
            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card rounded-xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${done ? "bg-primary/20" : "bg-secondary"}`}>
                    {done ? <CheckCircle className="w-5 h-5 text-primary" /> : <Icon className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-primary">+₦{points}</p>
                    {type === "watch_ad" && !done && (
                      <p className="text-[8px] text-muted-foreground">30s video</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => completeTask(type)}
                  disabled={done || type === "login"}
                  className="btn-cta w-full h-8 rounded-lg text-[11px] font-bold mt-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  {done ? "✓ Completed" : type === "login" ? "✓ Auto-completed" : type === "watch_ad" ? (
                    <><Play className="w-3 h-3" /> Watch Video</>
                  ) : "Complete Task"}
                </button>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Video Ad Modal */}
      <AnimatePresence>
        {showVideoAd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="glass-card rounded-2xl p-5 max-w-sm w-full text-center"
            >
              {!adPlaying ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">Watch Video Ad</h3>
                  <p className="text-[11px] text-muted-foreground mb-4">Watch a 30-second promotional video to earn <span className="text-primary font-bold">₦200</span></p>
                  <button
                    onClick={startVideoAd}
                    className="btn-cta w-full h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" /> Start Watching
                  </button>
                  <button onClick={() => setShowVideoAd(false)} className="mt-3 text-[11px] text-muted-foreground hover:text-foreground">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {/* YouTube video ad */}
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-4 bg-secondary">
                    <iframe
                      src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0`}
                      className="absolute inset-0 w-full h-full"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      title="Video Ad"
                    />
                    {/* Progress bar at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary z-10">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 30, ease: "linear" }}
                      />
                    </div>
                  </div>

                  {/* Countdown */}
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-10 h-10 rounded-full border-2 border-primary flex items-center justify-center">
                      <span className="text-sm font-extrabold text-primary">{adCountdown}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">seconds remaining</p>
                  </div>
                  <p className="text-[9px] text-muted-foreground/60">Please wait for the video to finish</p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DailyTasks;
