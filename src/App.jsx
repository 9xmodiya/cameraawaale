import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Camera, Check, ChevronLeft, ChevronRight, Menu, X, Sparkles, Mail, Phone, List, Edit, Trash2, MessageCircle, MapPin, Lock, LogOut } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";

// --- ☁️ FIREBASE CLOUD CONFIGURATION ☁️ ---
// To run this on a public link (Chrome), Replace the values below with your own keys from console.firebase.google.com
const manualConfig = {
  apiKey: "AIzaSyAXE-wYAUcz6K9iy0LrQy2QUADSyeQSMLM",
  authDomain: "cameraawaale-app.firebaseapp.com",
  projectId: "cameraawaale-app",
  storageBucket: "cameraawaale-app.firebasestorage.app",
  messagingSenderId: "698097316194",
  appId: "1:698097316194:web:a64adf191738bbaad1fc3b"
};

// Logic: Use Platform Config if available (Preview), otherwise use Manual Config (Public Link)
const firebaseConfig = (typeof __firebase_config !== 'undefined') 
  ? JSON.parse(__firebase_config) 
  : manualConfig;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Use a unique ID for your production app so data persists correctly
const appId = typeof __app_id !== 'undefined' ? __app_id : 'cameraawaale-production';

// --- Constants & Helpers ---

// SECURITY: Change this PIN to restrict Admin access
const ADMIN_PIN = "7298"; 

const TIME_SLOTS = [
  "05:00 AM", "06:00 AM", "07:00 AM", "08:00 AM",
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "01:00 PM", "02:00 PM", "03:00 PM",
  "05:00 PM", "06:00 PM", "07:00 PM"
];

const EVENT_TYPES = [
  "Wedding", "Portrait", "Fashion", "Product", "Event/Function", "Concept/Fiction"
];

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatDatesList = (dates) => {
  if (!dates || dates.length === 0) return '';
  // Sort dates chronologically
  const sorted = [...dates].sort((a, b) => new Date(a) - new Date(b));
  return sorted.map(d => formatDate(d)).join(', ');
};

// --- Sub-Components (Moved OUTSIDE ShutterBook to fix focus issues) ---

const ProgressBar = ({ step }) => (
  <div className="flex items-center justify-between mb-8 px-4">
    {[1, 2, 3].map((s) => (
      <div key={s} className="flex flex-col items-center relative z-10">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${step >= s || step === 4 ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'bg-slate-200 text-slate-400'}`}>
          {step > s || step === 4 ? <Check size={20} /> : s}
        </div>
        <span className={`text-xs mt-2 font-medium ${step >= s || step === 4 ? 'text-indigo-600' : 'text-slate-400'}`}>
          {s === 1 ? 'Date' : s === 2 ? 'Time' : 'Details'}
        </span>
      </div>
    ))}
    <div className="absolute left-0 right-0 top-5 h-1 bg-slate-200 -z-0 mx-8 md:mx-16">
      <div className="h-full bg-indigo-600 transition-all duration-500 ease-out" style={{ width: step === 4 ? '100%' : `${((step - 1) / 2) * 100}%` }}></div>
    </div>
  </div>
);

const StepDate = ({ currentYear, currentMonth, today, maxDate, handlePreviousMonth, handleNextMonth, handleDateClick, selectedDates, bookings }) => {
  const currentCalendarDate = new Date(currentYear, currentMonth);
  const todayMonthStart = new Date(today.getFullYear(), today.getMonth());
  const maxMonthStart = new Date(maxDate.getFullYear(), maxDate.getMonth());
  const isPreviousDisabled = currentCalendarDate <= todayMonthStart;
  const isNextDisabled = currentCalendarDate >= maxMonthStart;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Select Dates</h2>
        <div className="flex space-x-2">
          <button onClick={handlePreviousMonth} disabled={isPreviousDisabled} className={`p-2 rounded-full text-slate-600 transition-colors ${isPreviousDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100'}`}>
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-slate-700 w-32 text-center">
            {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={handleNextMonth} disabled={isNextDisabled} className={`p-2 rounded-full text-slate-600 transition-colors ${isNextDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100'}`}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      
      <p className="text-sm text-slate-500 mb-4 text-center">
        Tap multiple dates to select them.
      </p>

      <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array(firstDayOfMonth).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
        {Array(daysInMonth).fill(null).map((_, i) => {
          const day = i + 1;
          const date = new Date(currentYear, currentMonth, day);
          const isToday = date.toDateString() === today.toDateString();
          const isPast = date < new Date(today.setHours(0,0,0,0));

          // Check if date is selected (Array check)
          const isSelected = selectedDates.some(d => d.toDateString() === date.toDateString());

          // Check if date is booked by someone else
          // We check 'dates' array in bookings, fallback to single 'date' for backward compatibility
          const isBooked = bookings && bookings.some(b => {
             const bookingDates = b.dates ? b.dates.map(d => new Date(d)) : (b.date ? [new Date(b.date)] : []);
             return bookingDates.some(bd => bd.toDateString() === date.toDateString()) && b.status !== 'Canceled';
          });

          return (
            <button
              key={day}
              disabled={isPast || isBooked}
              onClick={() => handleDateClick(date)}
              className={`
                aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-200
                ${isSelected 
                  ? 'bg-indigo-600 text-white shadow-indigo-200 shadow-lg scale-105' 
                  : isBooked
                    ? 'bg-red-50 text-red-300 border border-red-100 cursor-not-allowed'
                    : isPast 
                      ? 'text-slate-300 cursor-not-allowed' 
                      : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 bg-white border border-slate-100'
                }
                ${isToday && !isSelected && !isBooked ? 'border-indigo-600 border-2 text-indigo-600' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
      
      {/* Floating Action Button for Next Step if dates are selected */}
      {selectedDates.length > 0 && (
        <div className="mt-6 flex justify-end">
           <button 
             className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg animate-bounce-short flex items-center gap-2"
             onClick={() => document.getElementById('btn-next-step').click()} 
           >
             Next: Select Time <ChevronRight size={18} />
           </button>
           {/* Hidden trigger for main component logic */}
           <button id="btn-next-step" className="hidden" onClick={() => {}}></button>
        </div>
      )}
    </div>
  );
};

const StepTime = ({ setStep, selectedDates, selectedTime, handleTimeClick }) => (
  <div className="animate-fade-in">
    <div className="flex items-center gap-3 mb-6">
      <button onClick={() => setStep(1)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-500">
        <ChevronLeft size={20} />
      </button>
      <h2 className="text-xl font-bold text-slate-800">Select Time</h2>
    </div>
    <div className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
      <span className="font-semibold text-indigo-600">Dates:</span> {formatDatesList(selectedDates)}
    </div>
    <div className="grid grid-cols-3 gap-3">
      {TIME_SLOTS.map((time) => (
        <button key={time} onClick={() => handleTimeClick(time)} className={`py-3 px-2 rounded-lg text-sm font-medium border transition-all duration-200 ${selectedTime === time ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600'}`}>
          {time}
        </button>
      ))}
    </div>
  </div>
);

const StepDetails = ({ setStep, handleSubmit, selectedDates, selectedTime, formData, handleInputChange }) => (
  <div className="animate-fade-in">
    <div className="flex items-center gap-3 mb-6">
      <button onClick={() => setStep(2)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-500">
        <ChevronLeft size={20} />
      </button>
      <h2 className="text-xl font-bold text-slate-800">Your Details</h2>
    </div>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 bg-slate-50 p-4 rounded-xl mb-6 border border-slate-200">
        <div>
          <p className="text-xs text-slate-500 uppercase font-bold">Selected Dates</p>
          <p className="text-sm font-medium text-slate-800">{formatDatesList(selectedDates)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase font-bold">Time</p>
          <p className="text-sm font-medium text-slate-800">{selectedTime}</p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
        <div className="relative">
          <User className="absolute left-3 top-3 text-slate-400" size={18} />
          <input type="text" name="name" required value={formData.name} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="John Doe" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
          <div className="relative">
            <div className="absolute left-3 top-2.5 text-slate-500 font-medium flex items-center gap-1 border-r border-slate-300 pr-2">
               <span>+91</span>
            </div>
            <input 
                type="tel" 
                name="phone" 
                required 
                value={formData.phone} 
                onChange={handleInputChange} 
                className="w-full pl-16 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                placeholder="00000 00000" 
                maxLength="10"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email (Optional)</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
            <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="john@example.com" />
          </div>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Event Place / Venue</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            type="text"
            name="eventPlace"
            required
            value={formData.eventPlace}
            onChange={handleInputChange}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="e.g. Grand Hotel, City Park, Studio"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Function / Event Type</label>
        <div className="relative">
            <Camera className="absolute left-3 top-3 text-slate-400" size={18} />
          <select name="eventType" value={formData.eventType} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
            {EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Creative Vision / Story (Fiction)</label>
        <div className="relative">
          <Sparkles className="absolute left-3 top-3 text-indigo-400" size={18} />
          <textarea name="vision" value={formData.vision} onChange={handleInputChange} rows="3" className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="Describe your theme, story, or specific ideas for the shoot..."></textarea>
        </div>
      </div>
      <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all transform hover:-translate-y-0.5 mt-4">
        Confirm Booking
      </button>
    </form>
  </div>
);

const StepSuccess = ({ formData, selectedDates, selectedTime, resetForm }) => (
  <div className="flex flex-col items-center justify-center py-10 animate-fade-in text-center">
    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600 animate-bounce-short">
      <Check size={40} strokeWidth={3} />
    </div>
    <h2 className="text-2xl font-bold text-slate-800 mb-2">Booking Confirmed!</h2>
    <p className="text-slate-500 mb-8 max-w-xs mx-auto">
      Thank you, {formData.name}. {formData.email ? `We have sent a confirmation to ${formData.email}.` : `We will contact you at +91 ${formData.phone}.`}
    </p>
    <div className="bg-slate-50 p-6 rounded-2xl w-full max-w-sm border border-slate-200 mb-8 text-left shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <Camera className="text-indigo-600 mt-1" size={18} />
        <div>
          <p className="text-xs text-slate-400 uppercase font-bold">Function</p>
          <p className="font-semibold text-slate-800">{formData.eventType}</p>
        </div>
      </div>
      <div className="flex items-start gap-3 mb-3">
          <Clock className="text-indigo-600 mt-1" size={18} />
          <div>
            <p className="text-xs text-slate-400 uppercase font-bold">When</p>
            <p className="font-semibold text-slate-800">{formatDatesList(selectedDates)} at {selectedTime}</p>
          </div>
      </div>
      {/* Show Event Place in Success Screen */}
      {formData.eventPlace && (
        <div className="flex items-start gap-3 mb-3">
          <MapPin className="text-indigo-600 mt-1" size={18} />
          <div>
            <p className="text-xs text-slate-400 uppercase font-bold">Location</p>
            <p className="font-semibold text-slate-800">{formData.eventPlace}</p>
          </div>
        </div>
      )}
      {formData.vision && (
        <div className="flex items-start gap-3">
          <Sparkles className="text-indigo-600 mt-1" size={18} />
          <div>
            <p className="text-xs text-slate-400 uppercase font-bold">Vision</p>
            <p className="font-semibold text-slate-800 italic">"{formData.vision}"</p>
          </div>
        </div>
      )}
    </div>
    <button onClick={resetForm} className="text-indigo-600 font-semibold hover:text-indigo-800">
      Book Another Session
    </button>
  </div>
);

// --- NEW COMPONENT: Admin Login Screen ---
const StepAdminLogin = ({ onLogin, setStep }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) { 
      onLogin();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-10 animate-fade-in">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-600">
        <Lock size={30} />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Cameraawaale</h2>
      <p className="text-slate-500 mb-6 text-sm text-center">
        Please enter the Cameraawaale PIN to view bookings.
      </p>
      
      <form onSubmit={handleLogin} className="w-full max-w-xs">
        <input 
          type="password" 
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(false); }}
          placeholder="Enter PIN"
          className={`w-full text-center text-2xl tracking-widest p-3 rounded-xl border-2 focus:ring-0 focus:outline-none transition-all mb-4 ${error ? 'border-red-400 bg-red-50 text-red-600 placeholder-red-300' : 'border-slate-200 focus:border-indigo-500 text-slate-800'}`}
          maxLength={4}
          autoFocus
        />
        
        <button 
          type="submit" 
          className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Unlock
        </button>
        
        <button 
          type="button" 
          onClick={() => setStep(1)}
          className="w-full mt-4 text-slate-500 text-sm hover:text-slate-800"
        >
          Cancel
        </button>
      </form>
    </div>
  );
};

const AdminView = ({ setStep, loading, bookings, sendWhatsAppConfirmation, handleEditClick, handleDeleteBooking, onLogout }) => {
  // Helper function to group and sort bookings
  const getGroupedBookings = (bookingList) => {
    const groups = {};
    bookingList.forEach(booking => {
      // Handle legacy 'date' and new 'dates' array
      const dateList = booking.dates ? booking.dates.map(d => new Date(d)) : (booking.date ? [new Date(booking.date)] : []);
      
      dateList.forEach(dateObj => {
        const dateKey = dateObj.toDateString();
        if (!groups[dateKey]) groups[dateKey] = [];
        // Only push if this booking doesn't already exist for this date (prevents duplicates in multi-day)
        if (!groups[dateKey].some(b => b.id === booking.id)) {
            groups[dateKey].push(booking);
        }
      });
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => new Date(a) - new Date(b));
    return sortedKeys.map(dateKey => ({
      date: dateKey,
      bookings: groups[dateKey].sort((a, b) => a.time.localeCompare(b.time))
    }));
  };

  const groupedBookings = getGroupedBookings(bookings);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Recent Bookings</h2>
        <div className="flex gap-2">
            <button onClick={onLogout} className="text-sm bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1">
                <Lock size={14} /> Lock
            </button>
            <button onClick={() => setStep(1)} className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-medium text-slate-600 transition-colors">
            Back to Home
            </button>
        </div>
      </div>

      {loading ? (
          <div className="text-center py-12 text-slate-400">Loading bookings...</div>
      ) : (
          <div className="space-y-6">
          {groupedBookings.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
              <Camera size={48} className="mx-auto mb-3 opacity-20" />
              No bookings yet.
              </div>
          ) : (
              groupedBookings.map((group) => (
              <div key={group.date} className="relative shadow-md rounded-xl overflow-hidden">
                  <h3 className="text-lg font-bold text-white bg-indigo-600 p-3 sticky top-0 z-10">
                  <Calendar size={18} className="inline mr-2 -mt-0.5" />
                  {formatDate(group.date)}
                  </h3>
                  <div className="bg-white divide-y divide-slate-100">
                  {group.bookings.map((booking) => (
                      // Use booking.id alone for key here, as date grouping handles display
                      <div key={booking.id} className="p-4 transition-colors hover:bg-indigo-50">
                      <div className="flex justify-between items-start mb-2">
                          <div>
                          <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-md mb-1">
                              {booking.eventType}
                          </span>
                          <h3 className="font-bold text-slate-800 text-base">{booking.name}</h3>
                          </div>
                          <div className="text-right">
                          <p className="text-sm font-bold text-indigo-700">{booking.time}</p>
                          <p className={`text-xs font-semibold ${booking.status === 'Confirmed' ? 'text-green-500' : booking.status === 'Canceled' ? 'text-red-500' : 'text-yellow-500'}`}>
                              {booking.status}
                          </p>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 gap-1 text-sm text-slate-600 mt-2 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400" /> +91 {booking.phone}
                          </div>
                          {booking.email && (
                            <div className="flex items-center gap-2">
                            <Mail size={14} className="text-slate-400" /> {booking.email}
                            </div>
                          )}
                          {booking.eventPlace && (
                            <div className="flex items-center gap-2">
                              <MapPin size={14} className="text-slate-400" /> {booking.eventPlace}
                            </div>
                          )}
                      </div>
                      
                      {/* Show if multi-day booking */}
                      {booking.dates && booking.dates.length > 1 && (
                         <div className="mt-1 text-xs text-indigo-500 font-semibold">
                            (Booking for {booking.dates.length} days: {formatDatesList(booking.dates.map(d => new Date(d)))})
                         </div>
                      )}

                      {booking.vision && (
                          <div className="mt-3 bg-slate-100 p-2 rounded text-xs text-slate-700 italic border border-slate-200">
                          <Sparkles size={12} className="inline mr-1 text-indigo-500" />
                          "{booking.vision}"
                          </div>
                      )}
                      <div className="flex space-x-2 justify-end mt-3">
                          <button onClick={() => sendWhatsAppConfirmation(booking)} className="flex items-center gap-1 text-xs px-3 py-1 bg-green-50 hover:bg-green-100 text-green-600 font-medium rounded-lg transition-colors">
                              <MessageCircle size={14} /> WhatsApp
                          </button>
                          <button onClick={() => handleEditClick(booking)} className="flex items-center gap-1 text-xs px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium rounded-lg transition-colors">
                              <Edit size={14} /> Edit
                          </button>
                          <button onClick={() => handleDeleteBooking(booking.id)} className="flex items-center gap-1 text-xs px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg transition-colors">
                              <Trash2 size={14} /> Delete
                          </button>
                      </div>
                      </div>
                  ))}
                  </div>
              </div>
              ))
          )}
          </div>
      )}
    </div>
  );
};

const BookingEditModal = ({ booking, onClose, onSave, timeSlots, eventTypes }) => {
  const [editData, setEditData] = useState(booking);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!editData.name || !editData.phone || !editData.time) {
        return;
    }
    onSave(editData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in-up overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <h3 className="text-xl font-bold text-slate-800">Edit Booking</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input type="text" name="name" value={editData.name} onChange={handleEditChange} required className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 font-medium">+91</span>
                <input type="tel" name="phone" value={editData.phone} onChange={handleEditChange} required className="w-full pl-12 pr-2.5 py-2.5 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email (Optional)</label>
              <input type="email" name="email" value={editData.email} onChange={handleEditChange} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Optional" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dates</label>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
                 {editData.dates ? formatDatesList(editData.dates.map(d => new Date(d))) : (editData.date ? formatDate(editData.date) : 'N/A')}
              </div>
              <p className="text-xs text-slate-400 mt-1">Note: To change dates, you must delete and re-book.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
              <select name="time" value={editData.time} onChange={handleEditChange} required className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Edit Event Place */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Event Place / Venue</label>
            <input type="text" name="eventPlace" value={editData.eventPlace || ''} onChange={handleEditChange} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Event Type</label>
            <select name="eventType" value={editData.eventType} onChange={handleEditChange} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white">
              {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Creative Vision</label>
            <textarea name="vision" value={editData.vision} onChange={handleEditChange} rows="3" className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Describe the creative vision..."></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select name="status" value={editData.status} onChange={handleEditChange} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white">
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Canceled">Canceled</option>
            </select>
          </div>
          
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-300 hover:bg-indigo-700 transition-colors mt-4">
            Save Changes
          </button>
          <button type="button" onClick={onClose} className="w-full text-slate-600 font-medium py-2 rounded-xl hover:bg-slate-100 transition-colors">
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Main Component ---

const ShutterBook = () => {
  // --- Global State ---
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false); // NEW STATE: For Admin Auth

  // --- Local UI State ---
  const [step, setStep] = useState(1); 
  const [selectedDates, setSelectedDates] = useState([]); // Changed to Array
  const [selectedTime, setSelectedTime] = useState(null);
  
  const [formData, setFormData] = useState({ 
    name: '',
    email: '',
    phone: '',
    eventPlace: '', // Added new field
    eventType: 'Portrait',
    vision: '',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- Firebase Auth & Data Sync ---
  
  // 1. Authentication
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching (Live Sync)
  useEffect(() => {
    if (!user) return;

    // We use a PUBLIC collection so both "Admins" and "Customers" see the availability/bookings
    // In a real production app, you might want to separate these, but for this prototype, a shared list is needed.
    const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    
    const unsubscribe = onSnapshot(bookingsRef, (snapshot) => {
      const loadedBookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBookings(loadedBookings);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching bookings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Calendar Logic ---
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const maxDate = new Date();
  maxDate.setFullYear(today.getFullYear() + 2); 

  const handlePreviousMonth = () => {
    const currentCalendarDate = new Date(currentYear, currentMonth);
    const todayMonthStart = new Date(today.getFullYear(), today.getMonth());
    if (currentCalendarDate <= todayMonthStart) return;
    setCurrentMonth(prev => prev === 0 ? 11 : prev - 1);
    if (currentMonth === 0) setCurrentYear(prev => prev - 1);
  };

  const handleNextMonth = () => {
    const currentCalendarDate = new Date(currentYear, currentMonth);
    const maxMonthStart = new Date(maxDate.getFullYear(), maxDate.getMonth());
    if (currentCalendarDate >= maxMonthStart) return;
    setCurrentMonth(prev => prev === 11 ? 0 : prev + 1);
    if (currentMonth === 11) setCurrentYear(prev => prev + 1);
  };

  const handleDateClick = (date) => {
    // Check if date is already selected
    const isSelected = selectedDates.some(d => d.toDateString() === date.toDateString());
    
    if (isSelected) {
      // Remove date
      setSelectedDates(prev => prev.filter(d => d.toDateString() !== date.toDateString()));
    } else {
      // Add date
      setSelectedDates(prev => [...prev, date]);
    }
    // Auto-advance is handled by the button in StepDate now to allow multi-select
  };

  const handleTimeClick = (time) => {
    setSelectedTime(time);
    setStep(3);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    const newBooking = {
      dates: selectedDates.map(d => d.toISOString()), // Store as array of ISO strings
      // fallback for old logic
      date: selectedDates[0].toISOString(),
      time: selectedTime,
      ...formData,
      status: "Pending",
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), newBooking);
      setStep(4);
    } catch (error) {
      console.error("Error saving booking:", error);
      alert("Failed to save booking. Please try again.");
    }
  };

  const resetForm = () => {
    setSelectedDates([]);
    setSelectedTime(null);
    setFormData({ name: '', email: '', phone: '', eventPlace: '', eventType: 'Portrait', vision: '' });
    setStep(1);
  };

  // --- Booking Edit Handlers ---
  const handleEditClick = (booking) => {
    setEditingBooking(booking);
    setIsEditing(true);
  };

  const handleCloseEdit = () => {
    setIsEditing(false);
    setEditingBooking(null);
  };

  const handleUpdateBooking = async (updatedBooking) => {
    if (!user) return;
    try {
      const bookingRef = doc(db, 'artifacts', appId, 'public', 'data', 'bookings', updatedBooking.id);
      await updateDoc(bookingRef, updatedBooking);
      handleCloseEdit();
    } catch (error) {
      console.error("Error updating booking:", error);
      alert("Failed to update booking.");
    }
  };

  const handleDeleteBooking = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id));
    } catch (error) {
      console.error("Error deleting booking:", error);
      alert("Failed to delete booking.");
    }
  };

  const sendWhatsAppConfirmation = (booking) => {
    // Handle phone number safely
    const rawPhone = booking.phone || '';
    const phone = rawPhone.replace(/\D/g, ''); 
    
    // Handle multiple dates display
    const datesDisplay = booking.dates 
      ? formatDatesList(booking.dates.map(d => new Date(d)))
      : (booking.date ? formatDate(booking.date) : 'N/A');

    const message = `Hello ${booking.name}, your booking with Cameraawaale (9X MODIYA PRODUCTION) is confirmed!%0A%0A📅 Dates: ${datesDisplay}%0A⏰ Time: ${booking.time}%0A📍 Place: ${booking.eventPlace || 'N/A'}%0A📸 Event: ${booking.eventType}%0A%0ASee you soon!`;
    window.open(`https://wa.me/91${phone}?text=${message}`, '_blank');
  };

  // Trigger for the hidden "Next" button in StepDate
  useEffect(() => {
    const btn = document.getElementById('btn-next-step');
    if (btn) {
      btn.onclick = () => setStep(2);
    }
  });

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex justify-center items-start pt-4 sm:pt-10 px-4 pb-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden min-h-[600px] flex flex-col relative">
        <div className="bg-slate-900 text-white p-6 relative">
          <div className="flex justify-between items-center relative z-10">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Cameraawaale</h1>
              <p className="text-slate-400 text-xs mt-1">9X MODIYA PRODUCTION</p>
            </div>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-600 rounded-full opacity-20 blur-xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-purple-600 rounded-full opacity-20 blur-xl"></div>
        </div>

        {isMenuOpen && (
          <div className="absolute top-[88px] left-0 right-0 bg-white shadow-lg border-b border-slate-100 z-20 animate-slide-down">
            <div className="p-2 space-y-1">
              <button onClick={() => { setStep(1); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-50 font-medium text-slate-700 flex items-center gap-3">
                <Camera size={18} className="text-indigo-600" /> Book a Session
              </button>
              <button onClick={() => { setStep(5); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-50 font-medium text-slate-700 flex items-center gap-3">
                <List size={18} className="text-indigo-600" /> My Bookings (Cameraawaale)
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 p-6 relative">
          {step < 4 && step !== 5 && <ProgressBar step={step} />}
          <div className="mt-2">
            {step === 1 && <StepDate 
                currentYear={currentYear} 
                currentMonth={currentMonth} 
                today={today} 
                maxDate={maxDate} 
                handlePreviousMonth={handlePreviousMonth} 
                handleNextMonth={handleNextMonth} 
                handleDateClick={handleDateClick} 
                selectedDates={selectedDates}
                bookings={bookings}
            />}
            {step === 2 && <StepTime 
                setStep={setStep} 
                selectedDates={selectedDates} 
                selectedTime={selectedTime} 
                handleTimeClick={handleTimeClick} 
            />}
            {step === 3 && <StepDetails 
                setStep={setStep} 
                handleSubmit={handleSubmit} 
                selectedDates={selectedDates} 
                selectedTime={selectedTime} 
                formData={formData} 
                handleInputChange={handleInputChange} 
            />}
            {step === 4 && <StepSuccess 
                formData={formData} 
                selectedDates={selectedDates} 
                selectedTime={selectedTime} 
                resetForm={resetForm} 
            />}
            
            {step === 5 && !isAdmin && <StepAdminLogin onLogin={() => setIsAdmin(true)} setStep={setStep} />}
            {step === 5 && isAdmin && <AdminView 
                setStep={setStep} 
                loading={loading} 
                bookings={bookings} 
                sendWhatsAppConfirmation={sendWhatsAppConfirmation} 
                handleEditClick={handleEditClick} 
                handleDeleteBooking={handleDeleteBooking} 
                onLogout={() => setIsAdmin(false)} 
            />}
          </div>
        </div>
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100 text-xs text-slate-400">
          <p>© 2018 Cameraawaale</p>
        </div>
      </div>
      
      {isEditing && editingBooking && (
        <BookingEditModal booking={editingBooking} onClose={handleCloseEdit} onSave={handleUpdateBooking} timeSlots={TIME_SLOTS} eventTypes={EVENT_TYPES} />
      )}

      <style>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-slide-down { animation: slideDown 0.2s ease-out forwards; }
        .animate-bounce-short { animation: bounceShort 1s ease-in-out infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceShort { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ShutterBook;