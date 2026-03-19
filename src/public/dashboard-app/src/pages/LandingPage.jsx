import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';

const features = [
  {
    title: 'Launch faster',
    desc: 'Unify APIs, tools, and automations in one secure dashboard.',
  },
  {
    title: 'Stay in control',
    desc: 'Manage token access and service permissions with confidence.',
  },
  {
    title: 'Scale with clarity',
    desc: 'Grow from solo workflow to team operations without chaos.',
  },
];

function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    window.location.href = '/dashboard/';
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
        <div className="grid gap-12 lg:min-h-[80vh] lg:grid-cols-12 lg:items-center lg:gap-16 xl:gap-20">
          {/* Left Section - Brand & Features */}
          <section className="lg:col-span-5">
            <div className="max-w-xl">
              <BrandLogo size="lg" className="mb-8" />
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-blue-300">MyApi Platform</p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.65rem] lg:leading-[1.1]">
                The professional command center for APIs, tokens, and AI workflows.
              </h1>
              <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
                Connect providers, protect credentials, and run your automation stack from one focused workspace.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {features.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-slate-400 sm:text-sm">
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">Encrypted token storage</span>
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">OAuth authentication</span>
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">Self-host friendly</span>
              </div>
            </div>
          </section>

          {/* Right Section - Call-to-Action */}
          <section className="lg:col-span-7">
            <div className="rounded-3xl border border-slate-700/80 bg-slate-900/85 p-5 shadow-2xl shadow-black/40 sm:p-7 lg:p-10">
              <div className="text-center">
                <h2 className="text-3xl font-semibold text-white mb-3">Get started with MyApi</h2>
                <p className="text-slate-400 mb-8 text-lg">Choose your path to unlock your automation potential.</p>

                <div className="space-y-4 max-w-sm mx-auto">
                  {/* Sign Up Button */}
                  <button
                    onClick={() => navigate('/dashboard/signup')}
                    className="w-full min-h-[56px] rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white transition-all hover:bg-blue-500 active:scale-95 shadow-lg hover:shadow-blue-500/25"
                  >
                    <span className="block">Sign Up</span>
                    <span className="text-sm font-normal text-blue-100">Create a new account</span>
                  </button>

                  {/* Login Button */}
                  <button
                    onClick={() => navigate('/dashboard/login')}
                    className="w-full min-h-[56px] rounded-xl border-2 border-slate-600 px-6 py-4 text-lg font-semibold text-white transition-all hover:border-slate-500 hover:bg-slate-800/50 active:scale-95"
                  >
                    <span className="block">Log In</span>
                    <span className="text-sm font-normal text-slate-300">Sign in to your account</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-12 text-center text-sm text-slate-400">
          <a href="/privacy" className="hover:text-slate-200 transition-colors">Privacy Policy</a>
          <span className="mx-2">·</span>
          <a href="/terms" className="hover:text-slate-200 transition-colors">Terms of Use</a>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
