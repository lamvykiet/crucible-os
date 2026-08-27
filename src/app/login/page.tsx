"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ArrowRight, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);

  // Thẻ bên phải hiển thị ngày/giờ hiện tại. Render nó ở phía server sẽ tạo ra
  // HTML khác với client (khác múi giờ, khác thời điểm) và gây lỗi hydration,
  // nên chỉ vẽ sau khi đã mount. setState trong effect ở đây là cố ý.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // proxy.ts gắn ?redirectTo=<đích> khi chặn request chưa đăng nhập.
      // Đọc từ window thay vì useSearchParams() để khỏi phải bọc Suspense.
      // Chỉ nhận đường dẫn nội bộ — chặn open redirect sang tên miền ngoài.
      const redirectTo = new URLSearchParams(window.location.search).get("redirectTo");
      const safeTarget =
        redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : "/";
      router.push(safeTarget);
      router.refresh();
    }
  };

  const date = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = dayNames[date.getDay()];
  const dateNum = date.getDate();
  const postfix = dateNum === 1 || dateNum === 21 || dateNum === 31 ? 'st' : dateNum === 2 || dateNum === 22 ? 'nd' : dateNum === 3 || dateNum === 23 ? 'rd' : 'th';
  const hour = date.getHours();

  return (
    <div className="w-full min-h-screen relative flex items-center justify-center p-6 bg-[var(--color-bg)] overflow-hidden text-[var(--color-text)]">
      {/* Aesthetic Ambient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[var(--color-accent)] opacity-10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-[var(--color-success)] opacity-10 blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[30vw] h-[30vw] rounded-full bg-[var(--color-warning)] opacity-10 blur-[80px]" />
      </div>

      <div className="z-10 flex flex-col md:flex-row gap-6 w-full max-w-4xl justify-center items-stretch">
        
        {/* Left Column: Login Form + Dark Card */}
        <div className="flex flex-col gap-4 w-full max-w-sm">
          
          {/* Main Glassmorphism Login Card */}
          <div className="rounded-[32px] p-8 bg-[var(--color-surface)]/50 backdrop-blur-2xl border border-[var(--color-border)]/40 shadow-xl relative overflow-hidden flex-1">
            <div className="flex justify-between items-center mb-10">
              <span className="font-semibold opacity-70" style={{fontFamily: 'var(--font-body)'}}>Crucible OS</span>
              <span className="text-sm cursor-pointer opacity-70 hover:opacity-100 transition-opacity">Sign up</span>
            </div>
            
            <div className="flex justify-between items-end mb-8">
              <h1 className="c-h1 leading-none">Log in</h1>
              <div className="bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]/30 rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5">
                <Sparkles size={12} /> Google
              </div>
            </div>

            {error && (
              <div className="text-[var(--color-error)] text-xs mb-4 text-center bg-[var(--color-error)]/10 p-2 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-40 text-sm">@</span>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e-mail address" 
                  className="w-full bg-[var(--color-surface)]/70 backdrop-blur-md border border-[var(--color-border)]/50 rounded-full pl-10 pr-5 py-4 focus:outline-none focus:border-[var(--color-accent)] transition-all font-medium placeholder:opacity-60 text-base md:text-sm shadow-inner" 
                  required
                />
              </div>

              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔑</span>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password" 
                  className="w-full bg-[var(--color-surface)]/70 backdrop-blur-md border border-[var(--color-border)]/50 rounded-full pl-10 pr-[70px] py-4 focus:outline-none focus:border-[var(--color-accent)] transition-all font-medium placeholder:opacity-60 text-base md:text-sm shadow-inner" 
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-[var(--color-surface-2)] px-3 py-1 rounded-full text-[10px] font-semibold cursor-pointer hover:opacity-80">
                  I forgot
                </span>
              </div>

              <div className="mt-6 flex justify-between items-center">
                <div className="flex flex-col gap-1 w-[60%]">
                  <p className="text-[9px] opacity-50 leading-tight">
                    For use by authorized personnel only. Keep credentials secure.
                  </p>
                  <p className="text-[9px] opacity-70 font-semibold mt-1">Please consume responsibly!</p>
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-[20px] px-5 py-3 flex items-center justify-center hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  <ArrowRight size={20} strokeWidth={2.5} />
                </button>
              </div>
            </form>
          </div>

          {/* Dark "New In" Card below */}
          <div className="w-full rounded-[24px] p-6 bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-xl flex flex-col justify-between items-start gap-4">
            <div>
              <h3 className="c-h3">New in</h3>
              <p className="opacity-80 text-sm mt-1">Finance OS Module</p>
            </div>
            <div className="w-full flex justify-end">
              <span className="text-sm font-semibold opacity-90 cursor-pointer hover:opacity-100">Discover</span>
            </div>
          </div>
          
        </div>

        {/* Right Column: Date & Graphic Card (Hidden on very small screens) */}
        <div className="w-full max-w-sm rounded-[32px] p-8 bg-[var(--color-surface)]/80 backdrop-blur-2xl border border-[var(--color-border)]/50 shadow-xl relative overflow-hidden min-h-[500px] hidden md:flex flex-col justify-between">
          <div className="flex justify-between items-start z-10 relative">
            {mounted ? (
              <div>
                <h2 className="c-display leading-[0.9]">
                  {dayName}<br/>
                  <span className="opacity-40">{dateNum}{postfix}</span>
                </h2>
              </div>
            ) : (
              <div className="w-32 h-24"></div>
            )}
            <div className="text-right text-[10px] font-semibold opacity-50 uppercase tracking-widest leading-relaxed">
              <p>System Online</p>
              <p>Crucible OS</p>
            </div>
          </div>
          
          {/* Big Orange/Warm Gradient Blob */}
          <div className="absolute top-[40%] right-[-20%] w-[120%] h-[60%] bg-gradient-to-l from-[var(--color-warning)] via-[var(--color-error)] to-transparent rounded-full opacity-90 blur-sm transform -translate-y-1/2"></div>
          {/* Soft overlay to blend it slightly */}
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-surface)]/80 to-transparent pointer-events-none"></div>

          <div className="z-10 relative mt-auto mb-16">
             <p className="text-sm font-bold">{mounted ? `${hour} : 00` : '-- : --'}</p>
             <p className="text-sm opacity-80 mt-1">Crucible HQ</p>
             <p className="text-sm opacity-80">Ho Chi Minh City</p>
          </div>

          <div className="flex justify-between items-center z-10 relative">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full border-2 border-[var(--color-primary)] flex items-center justify-center opacity-80">
                <Sparkles size={12} />
              </div>
              <span className="text-sm font-bold">C.OS</span>
            </div>
            <button className="bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-full px-5 py-2.5 text-sm font-semibold flex items-center gap-2 hover:opacity-90 shadow-lg">
              Join in <ArrowRight size={16} strokeWidth={3} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
