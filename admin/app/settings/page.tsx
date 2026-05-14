'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateServiceFee } from '@/lib/actions';
import { Percent, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [fee, setFee] = useState<number>(5);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const res = await getSettings();
      if (res.success && res.serviceFee !== undefined) {
        setFee(res.serviceFee);
      }
      setIsLoading(false);
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    const res = await updateServiceFee(fee);
    
    if (res.success) {
      setMessage({ type: 'success', text: 'Service fee updated successfully!' });
    } else {
      setMessage({ type: 'error', text: res.error || 'Failed to update service fee' });
    }
    setIsSaving(false);
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-500 mt-1">Configure global application settings and parameters</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Percent className="w-5 h-5 text-gray-500" />
            Financial Settings
          </h2>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="animate-pulse flex space-x-4 h-10 w-1/3 bg-gray-100 rounded"></div>
          ) : (
            <div className="space-y-6 max-w-md">
              <div>
                <label htmlFor="serviceFee" className="block text-sm font-medium text-gray-700 mb-2">
                  Service Fee Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="serviceFee"
                    min="0"
                    max="100"
                    step="0.1"
                    value={fee}
                    onChange={(e) => setFee(parseFloat(e.target.value) || 0)}
                    className="block w-full pl-3 pr-10 py-3 border-gray-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border transition-shadow"
                    placeholder="e.g., 5"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  This fee is applied to all new bookings immediately across the platform.
                </p>
              </div>

              {message && (
                <div className={`p-4 rounded-lg flex items-start gap-3 ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                }`}>
                  {message.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  )}
                  <p className="text-sm font-medium">{message.text}</p>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


