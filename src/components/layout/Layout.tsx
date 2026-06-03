import { Outlet, Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

export const Layout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/roles' },
    { path: '/' },
    { path: '/report' },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-900 items-center justify-center font-sans overflow-hidden">
      {/* Simulate the round screen */}
      <div className="relative w-[320px] h-[320px] rounded-full bg-white shadow-2xl overflow-hidden ring-[12px] ring-zinc-800 flex flex-col">
        
        {/* Main Content */}
        <main className="flex-1 overflow-hidden relative">
          <Outlet />
        </main>

        {/* Minimal Bottom Pagination Dots */}
        <nav className="absolute bottom-4 w-full flex items-center justify-center gap-2 z-50">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "rounded-full transition-all duration-300",
                  isActive ? "w-2 h-2 bg-zinc-500" : "w-1.5 h-1.5 bg-zinc-300 hover:bg-zinc-400"
                )}
              />
            );
          })}
        </nav>
      </div>
    </div>
  );
};
