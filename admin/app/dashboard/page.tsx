import {
  Users,
  Briefcase,
  BookOpen,
  CalendarCheck,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import StatCard from '@/components/ui/StatCard';
import RevenueChart from '@/components/charts/RevenueChart';
import ProgressList from '@/components/ui/ProgressList';
import StatusBadge from '@/components/ui/StatusBadge';
import { getDashboardStats } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { stats: dbStats, recentBookings, bookingsByType, bookingsByLocation } = await getDashboardStats();

  const stats = [
    { label: 'Total Users', value: dbStats.totalUsers, icon: Users, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
    { label: 'Total Partners', value: dbStats.totalPartners, icon: Briefcase, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
    { label: 'Active Listings', value: dbStats.activeListings, icon: BookOpen, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
    { label: 'Pending Bookings', value: dbStats.pendingBookings, icon: CalendarCheck, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
    { label: 'Total Revenue', value: dbStats.totalRevenue, icon: DollarSign, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  ];

  return (
    <div className="p-6 pb-10 space-y-6">
      {/* At a Glance */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">At a Glance</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left column */}
        <div className="col-span-12 lg:col-span-7 space-y-5">
          <RevenueChart />

          {/* Recent Bookings */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Recent Bookings</h3>
              <Link
                href="/bookings"
                className="text-sm text-green-600 font-medium hover:text-green-700 transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['ID', 'Client', 'Partner', 'Listing', 'Amount', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wide font-semibold"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">#{b.id.substring(0, 8)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{b.client}</td>
                      <td className="px-4 py-3 text-gray-600">{b.partner}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{b.listing}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{b.amount}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                  {recentBookings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No recent bookings found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-12 lg:col-span-5 space-y-5">
          <ProgressList title="Bookings by Type" items={bookingsByType} />
          <ProgressList title="Bookings by Location" items={bookingsByLocation} />

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Partner Status</h3>
            <div className="space-y-3">
              {[
                { label: 'Verified', count: dbStats.verifiedPartners, color: 'text-green-600 bg-green-50' },
                { label: 'Pending', count: dbStats.pendingPartners, color: 'text-yellow-600 bg-yellow-50' },
                { label: 'Suspended', count: 0, color: 'text-red-600 bg-red-50' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${item.color}`}>
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
