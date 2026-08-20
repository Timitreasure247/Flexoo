import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-[#06150f] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#10271d] border border-green-500/20 shadow-lg shadow-green-500/10">
          <span className="text-3xl font-bold text-green-400">F</span>
        </div>

        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to Flexoo
        </h1>

        <p className="mt-3 text-sm text-gray-400">
          A simple, secure and modern way to get started.
        </p>

        <div className="mt-8 rounded-3xl border border-green-500/10 bg-[#0b2118] p-6 shadow-2xl">
          <h2 className="text-xl font-semibold">
            Get started with Flexoo
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            Create your account or sign in to continue.
          </p>

          <div className="mt-6 space-y-3">
            <Link
              to="/signup"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-green-500 to-lime-400 font-semibold text-black transition hover:scale-[1.01]"
            >
              Create Account
            </Link>

            <Link
              to="/login"
              className="flex h-12 w-full items-center justify-center rounded-xl border border-green-500/20 bg-[#10271d] font-semibold text-white transition hover:bg-[#153024]"
            >
              Sign In
            </Link>
          </div>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          © {new Date().getFullYear()} Flexoo. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Index;