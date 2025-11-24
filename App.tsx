import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { SignUp } from './components/SignUp';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'employee' | 'manager' | 'dept_head' | 'hr_admin' | 'system_admin';
  department: string;
  clearanceLevel: number;
}

type View = 'landing' | 'signup' | 'login' | 'dashboard' | 'admin';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [view, setView] = useState<View>('landing');
  const [dashboardView, setDashboardView] = useState<'dashboard' | 'admin'>('dashboard');

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem('sepbas_token');
    const savedUser = localStorage.getItem('sepbas_user');
    
    if (savedToken && savedUser) {
      setAccessToken(savedToken);
      setUser(JSON.parse(savedUser));
      setView('dashboard');
    }
  }, []);

  const handleLogin = (token: string, userData: User) => {
    setAccessToken(token);
    setUser(userData);
    setView('dashboard');
    localStorage.setItem('sepbas_token', token);
    localStorage.setItem('sepbas_user', JSON.stringify(userData));
    toast.success(`Welcome back, ${userData.name}!`);
  };

  const handleLogout = async () => {
    if (!accessToken) return;

    try {
      const { API_BASE_URL } = await import('./config/api');
      const response = await fetch(
        `${API_BASE_URL}/auth/logout`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        toast.success('Logged out successfully');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }

    setAccessToken(null);
    setUser(null);
    setView('landing');
    localStorage.removeItem('sepbas_token');
    localStorage.removeItem('sepbas_user');
  };

  // Render different views based on state
  if (view === 'landing') {
    return (
      <>
        <LandingPage 
          onNavigateToLogin={() => setView('login')}
          onNavigateToSignup={() => setView('signup')}
        />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  if (view === 'signup') {
    return (
      <>
        <SignUp 
          onBack={() => setView('landing')}
          onSuccess={() => setView('login')}
        />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  if (view === 'login') {
    return (
      <>
        <Login onLogin={handleLogin} />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  if (!user || !accessToken) {
    return (
      <>
        <LandingPage 
          onNavigateToLogin={() => setView('login')}
          onNavigateToSignup={() => setView('signup')}
        />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-slate-900">SEPBAS</h1>
                <p className="text-slate-600">Secure Employee Promotion & Bonus Approval System</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-slate-900">{user.name}</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-slate-700 bg-slate-100 border border-slate-200">
                    {user.role.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-slate-700 bg-slate-100 border border-slate-200">
                    Clearance: L{user.clearanceLevel}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1">
            <button
              onClick={() => setDashboardView('dashboard')}
              className={`px-4 py-3 border-b-2 transition-colors ${
                dashboardView === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Dashboard
            </button>
            {(user.role === 'hr_admin' || user.role === 'system_admin') && (
              <button
                onClick={() => setDashboardView('admin')}
                className={`px-4 py-3 border-b-2 transition-colors ${
                  dashboardView === 'admin'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                Admin Panel
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {dashboardView === 'dashboard' ? (
          <Dashboard user={user} accessToken={accessToken} />
        ) : (
          <AdminPanel user={user} accessToken={accessToken} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-slate-600">
            Addis Ababa Science and Technology University - Department of Software Engineering
          </p>
          <p className="text-center text-slate-500 mt-1">
            Computer System Security - Project Two
          </p>
        </div>
      </footer>

      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
