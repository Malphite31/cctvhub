import React, { useState, useEffect, useRef } from 'react';
import { UserAccount } from '../types';
import {
  Users,
  User,
  Plus,
  Trash2,
  RefreshCw,
  Shield,
  Eye,
  ChevronDown,
  Check
} from 'lucide-react';

interface UsersViewProps {
  onShowToast: (msg: string, isErr?: boolean) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ onShowToast }) => {
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'viewer' | 'admin'>('viewer');
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch {
      onShowToast('Failed to load user accounts', true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      onShowToast('Username and password are required', true);
      return;
    }
    if (password.length < 4) {
      onShowToast('Password must be at least 4 characters', true);
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/auth/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          display_name: displayName.trim() || username.trim(),
          role: role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        onShowToast(data.detail || 'Failed to create user', true);
        return;
      }

      onShowToast(`Account created for "${data.user?.display_name || username}" (${role})`);
      setUsername('');
      setPassword('');
      setDisplayName('');
      setRole('viewer');
      fetchUsers();
    } catch {
      onShowToast('Error connecting to user management service', true);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (userToDelete: string) => {
    if (userToDelete.toLowerCase() === 'admin') {
      onShowToast('Cannot delete root admin account', true);
      return;
    }
    if (!window.confirm(`Are you sure you want to remove account "${userToDelete}"?`)) return;

    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(userToDelete)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onShowToast(`User "${userToDelete}" removed successfully`);
        fetchUsers();
      } else {
        const data = await res.json();
        onShowToast(data.detail || 'Failed to delete user', true);
      }
    } catch {
      onShowToast('Error deleting user', true);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-5 overflow-y-auto space-y-4 text-xs font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#222222] flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/10 text-[#3B82F6] border border-[#3B82F6]/30">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                User Management & Family Access
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[10px] font-semibold border border-zinc-700">
                {usersList.length} Accounts
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Provision family members with view-only streams or configure full system administrators.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161616] hover:bg-[#202020] text-zinc-200 border border-[#262626] font-mono text-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#3B82F6]' : 'text-zinc-400'}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Add New Account Card */}
      <div className="rounded-2xl border border-[#222222] bg-[#121212] p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b border-[#222222]">
          <Plus className="h-4 w-4 text-[#3B82F6]" />
          <h2 className="font-semibold text-white text-xs uppercase tracking-wider font-mono">
            Add New Family Member or Operator
          </h2>
        </div>

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                Username <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. mom, dad, sister"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#18181b] border border-[#2a2a2e] rounded-xl px-3 py-2 text-white text-xs focus:border-[#3B82F6] focus:outline-none font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                Password <span className="text-rose-400">*</span>
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#18181b] border border-[#2a2a2e] rounded-xl px-3 py-2 text-white text-xs focus:border-[#3B82F6] focus:outline-none font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                Display Name / Relation
              </label>
              <input
                type="text"
                placeholder="e.g. Mom's iPhone, Living Room TV"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-[#18181b] border border-[#2a2a2e] rounded-xl px-3 py-2 text-white text-xs focus:border-[#3B82F6] focus:outline-none transition-colors"
              />
            </div>

            <div className="relative" ref={roleMenuRef}>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                Role & Permissions
              </label>
              <button
                type="button"
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="w-full bg-[#18181b] border border-[#2a2a2e] hover:border-[#3B82F6] rounded-xl px-3 py-2 text-white text-xs font-mono flex items-center justify-between transition-colors text-left"
              >
                <div className="flex items-center gap-2 truncate">
                  {role === 'admin' ? (
                    <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  )}
                  <span className="truncate">
                    {role === 'admin' ? 'Administrator' : 'Family Viewer'}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0 ml-1" />
              </button>

              {showRoleMenu && (
                <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border border-[#2a2a2e] bg-[#141418] p-1.5 shadow-2xl z-50 space-y-1 font-mono text-xs animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('viewer');
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-start justify-between transition-colors ${
                      role === 'viewer'
                        ? 'bg-[#3B82F6]/20 border border-[#3B82F6]/50 text-white'
                        : 'text-zinc-300 hover:bg-[#1f1f23]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Eye className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-white text-xs">Family Viewer</div>
                        <div className="text-[10px] text-zinc-400 font-sans mt-0.5 leading-snug">
                          Streams & recordings only. No admin settings.
                        </div>
                      </div>
                    </div>
                    {role === 'viewer' && <Check className="h-3.5 w-3.5 text-[#3B82F6] shrink-0 mt-0.5 ml-1" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('admin');
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-start justify-between transition-colors ${
                      role === 'admin'
                        ? 'bg-[#3B82F6]/20 border border-[#3B82F6]/50 text-white'
                        : 'text-zinc-300 hover:bg-[#1f1f23]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-white text-xs">Administrator</div>
                        <div className="text-[10px] text-zinc-400 font-sans mt-0.5 leading-snug">
                          Full camera, user provisioning & system control.
                        </div>
                      </div>
                    </div>
                    {role === 'admin' && <Check className="h-3.5 w-3.5 text-[#3B82F6] shrink-0 mt-0.5 ml-1" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white font-mono font-medium rounded-xl text-xs flex items-center gap-2 shadow-lg transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{isCreating ? 'Creating Account...' : 'Add Family Account'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Registered Accounts List */}
      <div className="rounded-2xl border border-[#222222] bg-[#121212] p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <h2 className="font-semibold text-white text-xs uppercase tracking-wider font-mono">
              Active User Accounts ({usersList.length})
            </h2>
          </div>
        </div>

        {usersList.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 font-mono text-xs">
            Loading user accounts...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {usersList.map((u) => {
              const isAdmin = u.role === 'admin';
              return (
                <div
                  key={u.username}
                  className="p-3.5 rounded-xl bg-[#18181c] border border-[#26262a] hover:border-zinc-700 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-full shrink-0 ${
                      isAdmin
                        ? 'bg-blue-950/80 text-[#3B82F6] border border-blue-800/60'
                        : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                    }`}>
                      <User className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white font-mono text-xs truncate">
                          {u.username}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold tracking-wider ${
                          isAdmin
                            ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50'
                            : 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50'
                        }`}>
                          {isAdmin ? 'Admin' : 'Family Viewer'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {u.display_name}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-1">
                        Created: {new Date(u.created_at * 1000).toLocaleDateString()}
                        {u.last_login ? ` • Last active: ${new Date(u.last_login * 1000).toLocaleTimeString()}` : ' • No logins yet'}
                      </p>
                    </div>
                  </div>

                  {u.username !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u.username)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors shrink-0"
                      title={`Delete account "${u.username}"`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
