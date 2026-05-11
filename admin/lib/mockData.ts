// ─── Types ───────────────────────────────────────────────────────────────────

export type UserStatus = 'active' | 'inactive' | 'blocked';
export type UserRole = 'admin' | 'user' | 'guide';

export type PartnerStatus = 'verified' | 'pending' | 'suspended';

export type ListingStatus = 'active' | 'draft' | 'under_review' | 'archived';
export type ListingCategory = 'Tour' | 'Hotel' | 'Car Rental' | 'Adventure' | 'Cultural' | 'Food';

export type BookingStatus = 'completed' | 'pending' | 'confirmed' | 'cancelled';

// ─── Users ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  joinedDate: string;
  status: UserStatus;
  avatarInitials: string;
  avatarColor: string;
}

export const users: User[] = [
  { id: 'u1', name: 'Arjun Sharma', email: 'arjun@example.com', role: 'admin', joinedDate: '2024-01-15', status: 'active', avatarInitials: 'AS', avatarColor: 'bg-blue-500' },
  { id: 'u2', name: 'Priya Patel', email: 'priya@example.com', role: 'user', joinedDate: '2024-02-20', status: 'active', avatarInitials: 'PP', avatarColor: 'bg-pink-500' },
  { id: 'u3', name: 'Rohit Verma', email: 'rohit@example.com', role: 'guide', joinedDate: '2024-03-05', status: 'active', avatarInitials: 'RV', avatarColor: 'bg-purple-500' },
  { id: 'u4', name: 'Sneha Gupta', email: 'sneha@example.com', role: 'user', joinedDate: '2024-03-18', status: 'inactive', avatarInitials: 'SG', avatarColor: 'bg-orange-500' },
  { id: 'u5', name: 'Karan Mehta', email: 'karan@example.com', role: 'user', joinedDate: '2024-04-01', status: 'active', avatarInitials: 'KM', avatarColor: 'bg-teal-500' },
  { id: 'u6', name: 'Divya Reddy', email: 'divya@example.com', role: 'guide', joinedDate: '2024-04-12', status: 'active', avatarInitials: 'DR', avatarColor: 'bg-green-500' },
  { id: 'u7', name: 'Amit Singh', email: 'amit@example.com', role: 'user', joinedDate: '2024-05-03', status: 'blocked', avatarInitials: 'AS', avatarColor: 'bg-red-500' },
  { id: 'u8', name: 'Neha Joshi', email: 'neha@example.com', role: 'user', joinedDate: '2024-05-20', status: 'active', avatarInitials: 'NJ', avatarColor: 'bg-indigo-500' },
  { id: 'u9', name: 'Vikram Nair', email: 'vikram@example.com', role: 'user', joinedDate: '2024-06-08', status: 'inactive', avatarInitials: 'VN', avatarColor: 'bg-yellow-500' },
];

// ─── Partners ─────────────────────────────────────────────────────────────────

export interface Partner {
  id: string;
  name: string;
  businessName: string;
  location: string;
  listings: number;
  joinedDate: string;
  status: PartnerStatus;
  avatarInitials: string;
  avatarColor: string;
  email?: string;
  phone?: string;
  profileData?: any;
  documents?: string[];
  photoUrl?: string;
  kycVideoUrl?: string;
}

export const partners: Partner[] = [
  { id: 'p1', name: 'Rajesh Kumar', businessName: 'Kerala Tours & Travels', location: 'Kochi, Kerala', listings: 5, joinedDate: '2024-01-10', status: 'verified', avatarInitials: 'RK', avatarColor: 'bg-green-500' },
  { id: 'p2', name: 'Meera Iyer', businessName: 'Himalaya Adventures', location: 'Shimla, HP', listings: 3, joinedDate: '2024-02-28', status: 'pending', avatarInitials: 'MI', avatarColor: 'bg-blue-500' },
  { id: 'p3', name: 'Suresh Pillai', businessName: 'Heritage Stays', location: 'Jaipur, Rajasthan', listings: 7, joinedDate: '2024-03-15', status: 'verified', avatarInitials: 'SP', avatarColor: 'bg-purple-500' },
  { id: 'p4', name: 'Anita Desai', businessName: 'Coastal Retreats', location: 'Goa', listings: 0, joinedDate: '2024-04-20', status: 'suspended', avatarInitials: 'AD', avatarColor: 'bg-red-500' },
  { id: 'p5', name: 'Mohan Lal', businessName: 'Desert Camp Experiences', location: 'Jaisalmer, Rajasthan', listings: 4, joinedDate: '2024-05-05', status: 'pending', avatarInitials: 'ML', avatarColor: 'bg-orange-500' },
];

// ─── Listings ─────────────────────────────────────────────────────────────────

export interface Listing {
  id: string;
  name: string;
  partner: string;
  category: ListingCategory;
  location: string;
  price: string;
  status: ListingStatus;
  details?: any;
}

export const listings: Listing[] = [
  { id: 'l1', name: 'Backwaters Houseboat Cruise', partner: 'Rajesh Kumar', category: 'Tour', location: 'Alleppey, Kerala', price: '₹4,500/night', status: 'active' },
  { id: 'l2', name: 'Himalayan Trek Package', partner: 'Meera Iyer', category: 'Adventure', location: 'Manali, HP', price: '₹12,000/person', status: 'under_review' },
  { id: 'l3', name: 'Rajput Palace Experience', partner: 'Suresh Pillai', category: 'Cultural', location: 'Jaipur, Rajasthan', price: '₹8,000/night', status: 'active' },
  { id: 'l4', name: 'Goa Beach Villa', partner: 'Anita Desai', category: 'Hotel', location: 'Calangute, Goa', price: '₹6,500/night', status: 'archived' },
  { id: 'l5', name: 'Desert Safari & Camp', partner: 'Mohan Lal', category: 'Adventure', location: 'Jaisalmer, Rajasthan', price: '₹3,500/person', status: 'draft' },
  { id: 'l6', name: 'Street Food Tour Mumbai', partner: 'Rajesh Kumar', category: 'Food', location: 'Mumbai, Maharashtra', price: '₹1,200/person', status: 'active' },
  { id: 'l7', name: 'Munnar Tea Estate Drive', partner: 'Rajesh Kumar', category: 'Tour', location: 'Munnar, Kerala', price: '₹2,500/person', status: 'draft' },
  { id: 'l8', name: 'Rajasthan Car Rental', partner: 'Suresh Pillai', category: 'Car Rental', location: 'Jodhpur, Rajasthan', price: '₹2,000/day', status: 'active' },
];

// ─── Bookings ─────────────────────────────────────────────────────────────────

export interface Booking {
  id: string;
  client: string;
  partner: string;
  listing: string;
  dateTime: string;
  guests: number;
  amount: string;
  status: BookingStatus;
  paymentProvider?: string;
  paymentVerifiedAt?: string | null;
  razorpayOrderId?: string;
}

export const bookings: Booking[] = [
  { id: 'b001', client: 'Priya Patel', partner: 'Rajesh Kumar', listing: 'Backwaters Houseboat Cruise', dateTime: '2024-06-15 10:00', guests: 2, amount: '₹9,000', status: 'completed' },
  { id: 'b002', client: 'Karan Mehta', partner: 'Suresh Pillai', listing: 'Rajput Palace Experience', dateTime: '2024-06-18 14:00', guests: 4, amount: '₹32,000', status: 'confirmed' },
  { id: 'b003', client: 'Sneha Gupta', partner: 'Meera Iyer', listing: 'Himalayan Trek Package', dateTime: '2024-06-22 07:00', guests: 3, amount: '₹36,000', status: 'pending' },
  { id: 'b004', client: 'Rohit Verma', partner: 'Mohan Lal', listing: 'Desert Safari & Camp', dateTime: '2024-06-25 17:00', guests: 2, amount: '₹7,000', status: 'cancelled' },
  { id: 'b005', client: 'Neha Joshi', partner: 'Rajesh Kumar', listing: 'Street Food Tour Mumbai', dateTime: '2024-06-28 11:00', guests: 5, amount: '₹6,000', status: 'confirmed' },
  { id: 'b006', client: 'Vikram Nair', partner: 'Suresh Pillai', listing: 'Rajasthan Car Rental', dateTime: '2024-07-01 09:00', guests: 4, amount: '₹8,000', status: 'completed' },
  { id: 'b007', client: 'Divya Reddy', partner: 'Rajesh Kumar', listing: 'Munnar Tea Estate Drive', dateTime: '2024-07-05 08:00', guests: 2, amount: '₹5,000', status: 'pending' },
  { id: 'b008', client: 'Amit Singh', partner: 'Anita Desai', listing: 'Goa Beach Villa', dateTime: '2024-07-10 15:00', guests: 6, amount: '₹39,000', status: 'cancelled' },
  { id: 'b009', client: 'Arjun Sharma', partner: 'Meera Iyer', listing: 'Himalayan Trek Package', dateTime: '2024-07-15 07:00', guests: 1, amount: '₹12,000', status: 'confirmed' },
  { id: 'b010', client: 'Priya Patel', partner: 'Mohan Lal', listing: 'Desert Safari & Camp', dateTime: '2024-07-18 16:00', guests: 3, amount: '₹10,500', status: 'completed' },
];

// ─── Revenue Chart Data ────────────────────────────────────────────────────────

export interface RevenueDataPoint {
  day: string;
  weekly: number;
  monthly: number;
}

export const revenueData: RevenueDataPoint[] = [
  { day: 'Mon', weekly: 4200, monthly: 18000 },
  { day: 'Tue', weekly: 6800, monthly: 22000 },
  { day: 'Wed', weekly: 5100, monthly: 17500 },
  { day: 'Thu', weekly: 9300, monthly: 31000 },
  { day: 'Fri', weekly: 7600, monthly: 26500 },
  { day: 'Sat', weekly: 11200, monthly: 42000 },
  { day: 'Sun', weekly: 8500, monthly: 35000 },
];

// ─── Bookings by Type ─────────────────────────────────────────────────────────

export interface ProgressItem {
  name: string;
  percentage: number;
  color: string;
}

export const bookingsByType: ProgressItem[] = [
  { name: 'Tours & Sightseeing', percentage: 42, color: 'bg-green-500' },
  { name: 'Adventure Sports', percentage: 28, color: 'bg-blue-500' },
  { name: 'Hotel Stays', percentage: 18, color: 'bg-purple-500' },
  { name: 'Car Rental', percentage: 8, color: 'bg-orange-500' },
  { name: 'Food Tours', percentage: 4, color: 'bg-red-400' },
];

// ─── Bookings by Location ─────────────────────────────────────────────────────

export const bookingsByLocation: ProgressItem[] = [
  { name: 'Rajasthan', percentage: 35, color: 'bg-orange-500' },
  { name: 'Kerala', percentage: 28, color: 'bg-green-500' },
  { name: 'Goa', percentage: 20, color: 'bg-blue-500' },
  { name: 'Himachal Pradesh', percentage: 12, color: 'bg-purple-500' },
  { name: 'Maharashtra', percentage: 5, color: 'bg-gray-400' },
];
