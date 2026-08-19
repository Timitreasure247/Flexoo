import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import PullToRefresh from "./components/PullToRefresh.tsx";
import InstallPrompt from "./components/InstallPrompt.tsx";
import PageTransition from "./components/PageTransition.tsx";

// Eagerly loaded (entry / auth surfaces — small and always-first)
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import NotFound from "./pages/NotFound.tsx";

// Lazy-loaded to reduce initial bundle & speed up first paint
const SignupSuccess = lazy(() => import("./pages/SignupSuccess.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Home = lazy(() => import("./pages/Home.tsx"));
const Main = lazy(() => import("./pages/Main.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const EarnMore = lazy(() => import("./pages/EarnMore.tsx"));
const SpinAndEarn = lazy(() => import("./pages/SpinAndEarn.tsx"));
const History = lazy(() => import("./pages/History.tsx"));
const Support = lazy(() => import("./pages/Support.tsx"));
const Channel = lazy(() => import("./pages/Channel.tsx"));
const Withdraw = lazy(() => import("./pages/Withdraw.tsx"));
const WithdrawRequest = lazy(() => import("./pages/WithdrawRequest.tsx"));
const WithdrawalSuccess = lazy(() => import("./pages/WithdrawalSuccess.tsx"));
const WithdrawalApproved = lazy(() => import("./pages/WithdrawalApproved.tsx"));
const AdminPaymentSettings = lazy(() => import("./pages/AdminPaymentSettings.tsx"));
const AdminReferrals = lazy(() => import("./pages/AdminReferrals.tsx"));
const AdminCommunityChannels = lazy(() => import("./pages/AdminCommunityChannels.tsx"));
const ReferralHistory = lazy(() => import("./pages/ReferralHistory.tsx"));
const ReferralHub = lazy(() => import("./pages/ReferralHub.tsx"));
const DailyTasks = lazy(() => import("./pages/DailyTasks.tsx"));
const BuyCode = lazy(() => import("./pages/BuyCode.tsx"));
const Payment = lazy(() => import("./pages/Payment.tsx"));
const PaymentReceipt = lazy(() => import("./pages/PaymentReceipt.tsx"));
const PaymentReview = lazy(() => import("./pages/PaymentReview.tsx"));
const PaymentApproved = lazy(() => import("./pages/PaymentApproved.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const AppRoutes = () => {
  const location = useLocation();
  return (
    <PageTransition>
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signup-success" element={<ProtectedRoute><SignupSuccess /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/main" element={<ProtectedRoute><Main /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/earn-more" element={<ProtectedRoute><EarnMore /></ProtectedRoute>} />
          <Route path="/spin" element={<ProtectedRoute><SpinAndEarn /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
          <Route path="/channel" element={<Channel />} />
          <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
          <Route path="/withdraw-request" element={<ProtectedRoute><WithdrawRequest /></ProtectedRoute>} />
          <Route path="/withdrawal-success" element={<ProtectedRoute><WithdrawalSuccess /></ProtectedRoute>} />
          <Route path="/withdrawal-approved" element={<ProtectedRoute><WithdrawalApproved /></ProtectedRoute>} />
          <Route path="/admin/payment-settings" element={<ProtectedRoute><AdminPaymentSettings /></ProtectedRoute>} />
          <Route path="/admin/referrals" element={<ProtectedRoute><AdminReferrals /></ProtectedRoute>} />
          <Route path="/admin/community-channels" element={<ProtectedRoute><AdminCommunityChannels /></ProtectedRoute>} />
          <Route path="/referrals" element={<ProtectedRoute><ReferralHistory /></ProtectedRoute>} />
          <Route path="/referral-hub" element={<ProtectedRoute><ReferralHub /></ProtectedRoute>} />
          <Route path="/referral" element={<ProtectedRoute><ReferralHub /></ProtectedRoute>} />
          <Route path="/daily-tasks" element={<ProtectedRoute><DailyTasks /></ProtectedRoute>} />
          <Route path="/buy-code" element={<ProtectedRoute><BuyCode /></ProtectedRoute>} />
          <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
          <Route path="/payment-receipt" element={<ProtectedRoute><PaymentReceipt /></ProtectedRoute>} />
          <Route path="/payment-review" element={<ProtectedRoute><PaymentReview /></ProtectedRoute>} />
          <Route path="/payment-approved" element={<ProtectedRoute><PaymentApproved /></ProtectedRoute>} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </PageTransition>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={200}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PullToRefresh>
            <AppRoutes />
            <InstallPrompt />
          </PullToRefresh>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

