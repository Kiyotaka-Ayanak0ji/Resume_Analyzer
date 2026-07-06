import { NavLink, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, FileSearch, History, UserCircle, Settings, LogOut, Menu, FileCheck2,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard-link" },
  { to: "/analyze", label: "Analyze", icon: FileSearch, testid: "nav-analyze-link" },
  { to: "/history", label: "History", icon: History, testid: "nav-history-link" },
  { to: "/profile", label: "My Resumes", icon: UserCircle, testid: "nav-profile-link" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings-link" },
];

const NavItems = ({ onNavigate }) => (
  <nav className="flex flex-col gap-1 px-3">
    {NAV.map(({ to, label, icon: Icon, testid }) => (
      <NavLink
        key={to}
        to={to}
        data-testid={testid}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`
        }
      >
        <Icon className="h-4 w-4" />
        {label}
      </NavLink>
    ))}
  </nav>
);

const Brand = () => (
  <Link to="/dashboard" className="flex items-center gap-2 px-6 py-5" data-testid="appshell-brand-link">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <FileCheck2 className="h-4.5 w-4.5 h-4 w-4" />
    </span>
    <span className="font-heading text-lg font-semibold tracking-tight">Resume Decoded</span>
  </Link>
);

export const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const UserBlock = (
    <div className="mt-auto border-t px-6 py-4">
      <p className="truncate text-sm font-medium" data-testid="appshell-user-name">{user?.name}</p>
      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 w-full justify-start gap-2 text-muted-foreground"
        onClick={handleLogout}
        data-testid="appshell-logout-button"
      >
        <LogOut className="h-4 w-4" /> Log out
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:flex-col border-r bg-secondary/40">
        <Brand />
        <NavItems />
        {UserBlock}
      </aside>

      {/* Mobile topbar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
        <Brand />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu" data-testid="appshell-mobile-menu-button">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col p-0 pt-8">
            <NavItems />
            {UserBlock}
          </SheetContent>
        </Sheet>
      </header>

      <main className="min-w-0">{children}</main>
    </div>
  );
};
