'use client';

import { useState, useTransition } from 'react';
import { ArrowLeft, CheckCircle, XCircle, Edit2, Image as ImageIcon, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { approvePartner, rejectPartner } from '../actions';

export default function PartnerDetailClient({ partner }: { partner: any }) {
  const router = useRouter();
  const [approvalStatus, setApprovalStatus] = useState(partner.status);
  const [isPending, startTransition] = useTransition();
  
  const handleApprove = () => {
    startTransition(async () => {
      const res = await approvePartner(partner.id);
      if (res.success) {
        alert('Partner Approved!');
        setApprovalStatus('verified');
      } else {
        alert(res.error || 'Something went wrong');
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const res = await rejectPartner(partner.id);
      if (res.success) {
        alert('Partner Rejected!');
        setApprovalStatus('suspended');
      } else {
        alert(res.error || 'Something went wrong');
      }
    });
  };

  const profileData = partner.profileData || {};
  
  const knownKeys = ['avatar', 'emergencyContact', 'gender', 'jobType', 'category', 'experience', 'city', 'zone', 'address', 'aadharNumber', 'panNumber', 'bankAccount', 'ifscCode', 'bankNumber', 'upiId'];
  const dynamicRows = Object.entries(profileData).filter(([k, v]) => !knownKeys.includes(k) && v !== undefined && v !== null && v !== '');

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 bg-[#f4f5f5] min-h-screen">
      <div className="flex items-center justify-between">
        <Link href="/partners" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Partners</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-start justify-between relative overflow-hidden">
        {/* Left decoration line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-16 bg-red-500 rounded-r-full"></div>
        
        <div className="flex items-center gap-6 pl-4">
          <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-white shadow-md overflow-hidden flex items-center justify-center relative">
            {profileData.avatar || partner.photoUrl ? (
              <img src={profileData.avatar || partner.photoUrl} alt={partner.name} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full ${partner.avatarColor} flex items-center justify-center text-white text-3xl font-bold`}>
                {partner.avatarInitials}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{partner.name}</h1>
              {approvalStatus === 'verified' && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                  <CheckCircle className="w-3.5 h-3.5" /> KYC verified
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm">ID: {partner.id}</p>
            <p className="text-gray-600 text-sm font-medium">
              {partner.businessName} | {partner.location}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-4">
          <span className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
            approvalStatus === 'verified' ? 'bg-green-50 text-green-600 border border-green-200' :
            approvalStatus === 'pending' ? 'bg-red-50 text-red-600 border border-red-200' :
            'bg-yellow-50 text-yellow-600 border border-yellow-200'
          }`}>
            {approvalStatus === 'verified' ? 'Verified' : approvalStatus === 'pending' ? 'KYC pending' : 'Suspended'}
          </span>
          <div className="relative mt-auto">
            <select
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value)}
              className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent min-w-[200px]"
            >
              <option value="pending">Select Approval Status</option>
              <option value="verified">Verified</option>
              <option value="suspended">Suspended / Rejected</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Partner detail</h2>
          <button className="text-red-500 text-sm font-medium border border-red-100 bg-red-50 px-3 py-1.5 rounded-lg">Booking detail</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InputField label="Enter mobile number" value={partner.phone || 'N/A'} icon={<Edit2 className="w-4 h-4 text-gray-400" />} />
          <InputField label="Enter Email" value={partner.email || 'N/A'} icon={<Edit2 className="w-4 h-4 text-gray-400" />} />
          <InputField label="Emergency contact number" value={profileData.emergencyContact || 'N/A'} icon={<Edit2 className="w-4 h-4 text-gray-400" />} />
          
    
          
          <InputField label="Work Experience" value={profileData.experience || 'N/A'} />
          <SelectField label="City" value={profileData.city || 'N/A'} />
          <SelectField label="Zone" value={profileData.zone || 'N/A'} />
        </div>
        
        <div className="mt-6">
          <TextAreaField label="Address" value={profileData.address || 'N/A'} />
        </div>
      </div>

      {/* Business Profile Card */}
      {dynamicRows.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Business Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {dynamicRows.map(([key, value]) => {
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
              const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
              // Use TextAreaField for long texts like bio, amenities
              if (displayValue.length > 50) {
                return (
                  <div key={key} className="col-span-1 md:col-span-3">
                    <TextAreaField label={label} value={displayValue} />
                  </div>
                );
              }
              return <InputField key={key} label={label} value={displayValue} />;
            })}
          </div>
        </div>
      )}

      {/* KYC details & verification */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <h2 className="text-lg font-bold text-gray-900">KYC details & verification</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField label="Adhaar number" value={profileData.aadharNumber || 'N/A'} icon={<Edit2 className="w-4 h-4 text-gray-400" />} />
          <InputField label="PAN number" value={profileData.panNumber || 'N/A'} icon={<Edit2 className="w-4 h-4 text-gray-400" />} />
          
          {/* Uploaded Documents */}
          {partner.documents && partner.documents.length > 0 ? (
            partner.documents.map((docUrl: string, index: number) => (
              <div key={index} className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between min-h-[8rem] relative">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium text-gray-700">Document {index + 1}</span>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div className="mt-auto">
                  <span className="text-xs text-gray-400 mb-2 block">Uploaded File</span>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden shadow-sm">
                      <img src={docUrl} alt={`Document ${index + 1}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-800 font-medium truncate max-w-[150px]">
                        {docUrl.split('/').pop()?.slice(0, 20) || `Document ${index + 1}`}
                      </span>
                      <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-medium hover:underline">
                        View full image
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-1 md:col-span-2 border border-gray-200 rounded-xl p-4 flex items-center justify-center min-h-[8rem] text-gray-500 text-sm">
              No documents uploaded
            </div>
          )}

          {/* KYC Video URL */}
          {partner.kycVideoUrl ? (
            <div className="col-span-1 md:col-span-2 border border-gray-200 rounded-xl p-4 flex flex-col justify-between relative mt-4">
               <div className="flex justify-between items-start mb-4">
                  <span className="text-sm font-medium text-gray-700">KYC Video Verification</span>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div className="w-full max-w-md mx-auto rounded-lg overflow-hidden bg-black aspect-video flex-shrink-0">
                  <video src={partner.kycVideoUrl} controls className="w-full h-full object-contain" preload="metadata" />
                </div>
            </div>
          ) : (
            <div className="col-span-1 md:col-span-2 border border-gray-200 rounded-xl p-4 flex items-center justify-center min-h-[8rem] text-gray-500 text-sm mt-4">
              No KYC video uploaded
            </div>
          )}
        </div>
      </div>

      {/* Bank Details & UPI */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-8">
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Bank Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InputField label="Bank Account number" value={profileData.bankAccount || 'N/A'} icon={<Edit2 className="w-4 h-4 text-gray-400" />} />
            <InputField label="IFSC code" value={profileData.ifscCode || 'N/A'} icon={<Edit2 className="w-4 h-4 text-gray-400" />} />
            <InputField label="Bank Number" value={profileData.bankNumber || 'N/A'} icon={<Edit2 className="w-4 h-4 text-gray-400" />} />
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900">UPI Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InputField label="UPI number" value={profileData.upiId || 'N/A'} icon={<Edit2 className="w-4 h-4 text-gray-400" />} />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-4 pt-4 pb-8">
        <button 
          onClick={handleReject}
          className="px-8 py-3 text-red-600 font-semibold bg-white border border-red-200 rounded-lg shadow-sm hover:bg-red-50 transition-colors w-48 text-center"
        >
          Reject
        </button>
        <button 
          onClick={handleApprove}
          className="px-8 py-3 text-white font-semibold bg-red-600 rounded-lg shadow-sm hover:bg-red-700 transition-colors w-48 text-center"
        >
          Approve
        </button>
      </div>
    </div>
  );
}

// Helper components for form fields
function InputField({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-400 z-10">{label}</label>
      <div className="relative flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden focus-within:border-gray-400 focus-within:ring-1 focus-within:ring-gray-400 transition-colors">
        <input 
          type="text" 
          value={value} 
          readOnly 
          className="w-full px-4 py-3 text-sm text-gray-800 outline-none bg-transparent"
        />
        {icon && <div className="pr-4">{icon}</div>}
      </div>
    </div>
  );
}

function SelectField({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-400 z-10">{label}</label>
      <div className="relative flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden focus-within:border-gray-400 focus-within:ring-1 focus-within:ring-gray-400 transition-colors">
        <input 
          type="text" 
          value={value} 
          readOnly 
          className="w-full px-4 py-3 text-sm text-gray-800 outline-none bg-transparent"
        />
        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 pointer-events-none" />
      </div>
    </div>
  );
}

function TextAreaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-400 z-10">{label}</label>
      <textarea 
        value={value} 
        readOnly 
        rows={3}
        className="w-full px-4 py-3 text-sm text-gray-800 border border-gray-200 rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors resize-none"
      />
    </div>
  );
}
