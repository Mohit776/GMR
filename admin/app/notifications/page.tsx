'use client';

import { useState } from 'react';
import { sendCustomNotification } from './actions';
import { Send, Info, BellRing, CheckCircle, Search, AlertCircle } from 'lucide-react';

export default function NotificationsPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [targetType, setTargetType] = useState('all');

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setSuccess('');
    setError('');

    const res = await sendCustomNotification(formData);
    
    if (res.success) {
      setSuccess(`Successfully sent notifications to ${res.sentCount} devices.`);
      (document.getElementById('notification-form') as HTMLFormElement).reset();
    } else {
      setError(res.error || 'Failed to send notification');
    }
    
    setLoading(false);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Notifications Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Send Custom Notification */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Send className="w-5 h-5 text-green-600" />
            Send Custom Notification
          </h2>

          <form id="notification-form" action={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
              <select 
                name="targetType" 
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="all">All Users & Partners</option>
                <option value="users">Travelers (Users) Only</option>
                <option value="partners">Guides (Partners) Only</option>
                <option value="specific">Specific User/Partner ID</option>
              </select>
            </div>

            {targetType === 'specific' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User/Partner ID</label>
                <input 
                  type="text" 
                  name="targetId"
                  placeholder="e.g., 550e8400-e29b-41d4-a716-446655440000"
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notification Title</label>
              <input 
                type="text" 
                name="title"
                placeholder="e.g., Special Weekend Offer!"
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notification Message</label>
              <textarea 
                name="body"
                rows={4}
                placeholder="Type your message here..."
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
              ></textarea>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Notification
                </>
              )}
            </button>
          </form>
        </div>

        {/* Automatic Notification Triggers */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BellRing className="w-5 h-5 text-blue-600" />
              Automatic Notification Triggers
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              The system automatically sends push notifications in the following scenarios:
            </p>

            <div className="space-y-6">
              {/* Trigger 1 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Search className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">New Booking Request</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium text-gray-800">Target:</span> Eligible Partners (Guides)<br/>
                    <span className="font-medium text-gray-800">Trigger:</span> When a user creates a new booking request for a specific city or guide.<br/>
                    <span className="text-xs text-gray-400 block mt-1">Managed by Edge Function: send-booking-request</span>
                  </p>
                </div>
              </div>

              {/* Trigger 2 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Booking Accepted</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium text-gray-800">Target:</span> Traveler (User)<br/>
                    <span className="font-medium text-gray-800">Trigger:</span> When a guide accepts an open booking request.<br/>
                    <span className="text-xs text-gray-400 block mt-1">Managed by Edge Function: accept-booking-request</span>
                  </p>
                </div>
              </div>

              {/* Trigger 3 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Partner Approved</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium text-gray-800">Target:</span> Partner (Guide)<br/>
                    <span className="font-medium text-gray-800">Trigger:</span> When an admin approves a partner's profile from the Partners dashboard.<br/>
                    <span className="text-xs text-gray-400 block mt-1">Managed by Server Action: approvePartner</span>
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
