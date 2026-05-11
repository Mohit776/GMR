'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  BookOpen,
  CalendarCheck,
  Bell,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Partners', href: '/partners', icon: Briefcase },
  { name: 'Listings', href: '/listings', icon: BookOpen },
  { name: 'Bookings', href: '/bookings', icon: CalendarCheck },
  { name: 'Notifications', href: '/notifications', icon: Bell },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-gray-100 h-screen flex flex-col flex-shrink-0 shadow-sm">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100 flex-shrink-0">
        <span className="text-xl font-bold text-gray-900 tracking-tight">
          Guide My{' '}
          <span className="text-green-600">Route</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150
                ${isActive
                  ? 'bg-white border border-gray-200 text-gray-900 font-semibold border-l-4 border-l-green-600 shadow-sm'
                  : 'text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-green-600' : 'text-gray-400'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 flex-shrink-0">
        <p className="text-xs text-gray-400 text-center">Panel v1.0</p>
      </div>
    </aside>
  );
}
