import { useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { path: "/", label: "Dashboard", icon: "📊" },
  { path: "/transactions", label: "Tranzaksiyalar", icon: "💵" },
  { path: "/sources", label: "Manbalar", icon: "💰" },
  { path: "/categories", label: "Kategoriyalar", icon: "📂" },
  { path: "/credits", label: "Kreditlar", icon: "🏦" },
  { path: "/reports", label: "Hisobotlar", icon: "📈" },
];

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--tg-theme-bg-color)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--tg-theme-button-color)] text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <h1 className="text-lg font-bold">💰 Finance Manager</h1>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-lg hover:bg-white/10 transition"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* Navigation Menu */}
      {menuOpen && (
        <nav className="bg-[var(--tg-theme-secondary-bg-color)] border-b shadow-md">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition hover:bg-[var(--tg-theme-button-color)]/10 ${
                location.pathname === item.path
                  ? "bg-[var(--tg-theme-button-color)]/20 font-semibold"
                  : ""
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Main Content */}
      <main className="p-4 pb-20 max-w-2xl mx-auto">{children}</main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--tg-theme-secondary-bg-color)] border-t flex justify-around py-2 z-50">
        {navItems.slice(0, 5).map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition ${
              location.pathname === item.path
                ? "text-[var(--tg-theme-button-color)]"
                : "text-[var(--tg-theme-hint-color)]"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px]">{item.label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
