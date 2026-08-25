import React, { useState } from 'react';
import { X, LogIn, UserPlus, Shield, User, Key, UserCheck, Eye, EyeOff } from 'lucide-react';
import { userService } from '../services/userService';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login form state
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Registration form state
  const [regFullName, setRegFullName] = useState('');
  const [regShortName, setRegShortName] = useState('');
  const [regId, setRegId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const res = userService.login(loginId, loginPassword);
    if (res.success && res.user) {
      onSuccess(`Welcome back, ${res.user.fullName}!`);
      onClose();
      // Reset
      setLoginId('');
      setLoginPassword('');
    } else {
      setError(res.error || 'Login failed.');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = userService.registerUser(regFullName, regShortName, regId, regPassword);
    if (res.success && res.user) {
      onSuccess(`Registration successful! Logged in as ${res.user.fullName}.`);
      onClose();
      // Reset
      setRegFullName('');
      setRegShortName('');
      setRegId('');
      setRegPassword('');
    } else {
      setError(res.error || 'Registration failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-150"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative bg-[#121212] border border-[#2A2A2A] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Header Title */}
        <div className="px-5 py-4 bg-[#0A0A0A] border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              MIRMS Access Portal
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#1C1C1C] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 bg-[#0C0C0C] border-b border-[#222] p-1.5 gap-1">
          <button
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'login'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#161616]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('register');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'register'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#161616]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register Account</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-400 flex items-start gap-2 animate-in slide-in-from-top-2 duration-150">
              <div className="font-bold shrink-0">⚠️ Error:</div>
              <p className="leading-normal">{error}</p>
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Person ID Number
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-gray-500 absolute left-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. USER123 or ADMIN123"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#181818] border border-[#2F2F2F] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-hidden focus:border-blue-500 transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Key className="w-4 h-4 text-gray-500 absolute left-3" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 bg-[#181818] border border-[#2F2F2F] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-hidden focus:border-blue-500 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 text-gray-500 hover:text-white transition-colors"
                  >
                    {showLoginPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-98 font-bold text-xs text-white rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Verify & Sign In</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe Stone"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181818] border border-[#2F2F2F] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-hidden focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Short Name (Registered By Tag)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JD. Stone"
                  value={regShortName}
                  onChange={(e) => setRegShortName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181818] border border-[#2F2F2F] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-hidden focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Person ID Number
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-gray-500 absolute left-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. USER123, JD999, etc."
                    value={regId}
                    onChange={(e) => setRegId(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#181818] border border-[#2F2F2F] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-hidden focus:border-blue-500 transition-colors font-mono"
                  />
                </div>
                <p className="text-[10px] text-gray-500">
                  ID must be pre-authorized by an Admin in Access Settings.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Key className="w-4 h-4 text-gray-500 absolute left-3" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="Choose a strong password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 bg-[#181818] border border-[#2F2F2F] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-hidden focus:border-blue-500 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 text-gray-500 hover:text-white transition-colors"
                  >
                    {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-98 font-bold text-xs text-white rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register & Log In</span>
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
