import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, LayoutDashboard, Shield, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.png";

export function AppShell({
  title,
  subtitle,
  notifCount = 0,
  children,
}: {
  title: string;
  subtitle?: string;
  notifCount?: number;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { isAdmin, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="" className="h-8 w-8 rounded-md" />
            <span className="font-display text-sm font-extrabold tracking-tight">SR   <span className="text-primary"> GYM</span></span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
           
            {isAdmin && (
  <span className="flex items-center gap-1.5 text-sm font-semibold">
    <Shield className="h-4 w-4 text-primary" />
    Admin
  </span>
)}
          </nav>  

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {notifCount > 0 && (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <Dumbbell className="hidden h-8 w-8 shrink-0 text-primary sm:block" />
        </div>
        {children}
      </div>
    </div>
  );
}
