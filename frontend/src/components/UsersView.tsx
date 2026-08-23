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
import { ConfirmModal } from './ConfirmModal';

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
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  const [showAddUser, setShowAddUser] = useState(false);

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
      setShowAddUser(false);
      fetchUsers();
    } catch {
      onShowToast('Error connecting to user management service', true);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = (targetUsername: string) => {
    if (targetUsername.toLowerCase() === 'admin') {
      onShowToast('Cannot delete root admin account', true);
      return;
    }
    setUserToDelete(targetUsername);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(userToDelete)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onShowToast(`User account "${userToDelete}" removed successfully`);
        setUserToDelete(null);
        fetchUsers();
      } else {
        const data = await res.json();
        onShowToast(data.detail || 'Failed to delete user', true);
      }
    } catch {
      onShowToast('Error deleting user account', true);
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-2.5 sm:p-4 overflow-y-auto space-y-2.5 sm:space-y-3 text-xs font-sans select-none">
      {/* Top Compact Control Bar */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-lg border border-[#222222] bg-[#111111] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-md bg-blue-600/10 text-[#3B82F6] border border-[#3B82F6]/30 shrink-0">
            <Users className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-xs text-white truncate">
              User Accounts
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
              {usersList.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={fetchUsers}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white border border-[#2a2a2a] text-xs font-mono transition-colors disabled:opacity-50"
            title="Refresh user accounts list"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin text-[#3B82F6]' : 'text-zinc-400'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddUser(!showAddUser)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
              showAddUser
                ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600'
                : 'bg-[#3B82F6] hover:bg-blue-600 text-white'
            }`}
          >
            {showAddUser ? <ChevronDown className="h-3.5 w-3.5 rotate-180" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{showAddUser ? 'Close Form' : '+ Add User'}</span>
          </button>
        </div>
      </div>

      {/* Add New Account Collapsible Card */}
      {showAddUser && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#141416] p-3 sm:p-4 space-y-3 shadow-md animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
            <div className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-[#3B82F6]" />
              <h4 className="font-semibold text-white text-xs font-mono">
                Provision New Account
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowAddUser(false)}
              className="text-zinc-500 hover:text-zinc-300 p-1"
            >
              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            </button>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                  Username <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. mom, dad, alexis"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#2a2a2e] rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-[#3B82F6] focus:outline-none font-mono transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                  Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#2a2a2e] rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-[#3B82F6] focus:outline-none font-mono transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mom, Living Room TV"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#2a2a2e] rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-[#3B82F6] focus:outline-none transition-colors"
                />
              </div>

              <div className="relative" ref={roleMenuRef}>
                <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                  Role & Permissions
                </label>
                <button
                  type="button"
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className="w-full bg-[#18181b] border border-[#2a2a2e] hover:border-[#3B82F6] rounded-lg px-2.5 py-1.5 text-white text-xs font-mono flex items-center justify-between transition-colors text-left"
                >
                  <div className="flex items-center gap-1.5 truncate">
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
                  <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-[#2a2a2e] bg-[#141418] p-1 shadow-2xl z-50 space-y-0.5 font-mono text-xs animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setRole('viewer');
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-left p-1.5 rounded-md flex items-center justify-between transition-colors ${
                        role === 'viewer'
                          ? 'bg-[#3B82F6]/20 border border-[#3B82F6]/50 text-white'
                          : 'text-zinc-300 hover:bg-[#1f1f23]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Eye className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-white text-xs">Family Viewer</div>
                          <div className="text-[9px] text-zinc-400 font-sans">Streams only</div>
                        </div>
                      </div>
                      {role === 'viewer' && <Check className="h-3 w-3 text-[#3B82F6] shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRole('admin');
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-left p-1.5 rounded-md flex items-center justify-between transition-colors ${
                        role === 'admin'
                          ? 'bg-[#3B82F6]/20 border border-[#3B82F6]/50 text-white'
                          : 'text-zinc-300 hover:bg-[#1f1f23]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-white text-xs">Administrator</div>
                          <div className="text-[9px] text-zinc-400 font-sans">Full Control</div>
                        </div>
                      </div>
                      {role === 'admin' && <Check className="h-3 w-3 text-[#3B82F6] shrink-0" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isCreating}
                className="w-full sm:w-auto px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white font-mono font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{isCreating ? 'Creating...' : 'Save Account'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Accounts List Grid */}
      <div className="rounded-lg border border-[#222222] bg-[#111111] p-2.5 sm:p-3 space-y-2 shadow-sm flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#222222]">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-mono">
            <span>Provisioned Accounts</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            {usersList.length} Total
          </span>
        </div>

        {usersList.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 font-mono text-xs">
            Loading user accounts...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {usersList.map((u) => {
              const isAdmin = u.role === 'admin';
              return (
                <div
                  key={u.username}
                  className="p-2.5 sm:p-3 rounded-lg bg-[#161616] border border-[#222222] hover:border-zinc-700 flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`p-2 rounded-md shrink-0 ${
                      isAdmin
                        ? 'bg-blue-950/80 text-[#3B82F6] border border-blue-800/60'
                        : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                    }`}>
                      <User className="h-3.5 w-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-white font-mono text-xs truncate">
                          {u.username}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold tracking-wider ${
                          isAdmin
                            ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50'
                            : 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50'
                        }`}>
                          {isAdmin ? 'Admin' : 'Viewer'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {u.display_name}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                        {u.last_login ? `Active: ${new Date(u.last_login * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No logins yet'}
                      </p>
                    </div>
                  </div>

                  {u.username !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u.username)}
                      className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors shrink-0"
                      title={`Delete account "${u.username}"`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete User Account Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(userToDelete)}
        title="Delete User Account"
        message={
          <p>
            Are you sure you want to permanently remove account <strong className="text-white">"{userToDelete}"</strong>?
            This user will immediately lose access to all camera feeds and recorded surveillance.
          </p>
        }
        confirmText="Remove Account"
        isLoading={isDeletingUser}
        variant="danger"
        onConfirm={handleConfirmDeleteUser}
        onClose={() => setUserToDelete(null)}
      />
    </div>
  );
};
