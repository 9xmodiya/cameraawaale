import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Camera, Check, ChevronLeft, ChevronRight, Menu, X, Sparkles, Mail, Phone, List, Edit, Trash2, MessageCircle, MapPin, Lock, LogOut } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";

// --- ☁️ FIREBASE CLOUD CONFIGURATION ☁️ ---
const manualConfig = {
  apiKey: "AIzaSyAXE-wYAUcz6K9iy0LrQy2QUADSyeQSMLM",
  authDomain: "cameraawaale-app.firebaseapp.com",
  projectId: "cameraawaale-app",
  storageBucket: "cameraawaale-app.firebasestorage.app",
  messagingSenderId: "698097316194",
  appId: "1:698097316194:web:a64adf191738bbaad1fc3b"
};

const firebaseConfig = (typeof __firebase_config !== 'undefined') 
  ? JSON.parse(__firebase_config) 
  : manualConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'cameraawaale-production';

// --- Constants & Helpers ---

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

// --- Sub-Components ---

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
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  
  const currentCalendarDate = new Date(currentYear, currentMonth);
  const todayMonthStart = new Date(today.getFullYear(), today.getMonth());
  const maxMonthStart = new Date(maxDate.getFullYear(), maxDate.getMonth());
  const isPreviousDisabled = currentCalendarDate <= todayMonthStart;
  const isNextDisabled = currentCalendarDate >= maxMonthStart;

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Select Dates</h2>
        <div className="flex space-x-2">
          <button onClick={handlePreviousMonth} disabled={isPreviousDisabled} className={`p-2 rounded-full text-slate-600 transition-colors ${isPreviousDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100'}`}>