import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { toast } from 'sonner';
import { User } from '../App';

interface LoginProps {
  onLogin: (token: string, user: User) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [tempUserId, setTempUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { API_BASE_URL } = await import('../config/api');
      const url = `${API_BASE_URL}/auth/login`;
      console.log('Logging in to:', url);
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            mfaToken: showMfa ? mfaToken : undefined,
          }),
        }
      );

      // Parse response safely — some middleware (rate limiter) may return plain text
      // Use clone() so if JSON parsing fails we can fall back to text.
      let data: any;
      const respClone = response.clone();
      try {
        data = await response.json();
      } catch (parseErr) {
        const text = (await respClone.text()) || '';
        data = { error: text || `HTTP ${response.status}` };
      }

      if (!response.ok) {
        // Provide a more helpful message when rate-limited (429)
        if (response.status === 429) {
          const retryHeader = response.headers.get('Retry-After');
          const retryFromBody = data && data.retryAfterSeconds ? Number(data.retryAfterSeconds) : null;
          const retrySeconds = retryHeader ? Number(retryHeader) : retryFromBody;
          let retryMsg = 'Too many login attempts. Please try again later.';
          if (retrySeconds && !isNaN(retrySeconds)) {
            if (retrySeconds < 60) {
              retryMsg = `Too many attempts — try again in ${retrySeconds} seconds.`;
            } else {
              const minutes = Math.ceil(retrySeconds / 60);
              retryMsg = `Too many attempts — try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
            }
          }
          setError(retryMsg);
          setLoading(false);
          return;
        }

        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      if (data.mfaRequired) {
        setShowMfa(true);
        setTempUserId(data.userId);
        
        // Try to get QR code if user needs to set up MFA
        // First, login with password to get a temporary token for QR code request
        // For now, we'll show instructions
        toast.info('MFA is required. Please enter your 6-digit code from Google Authenticator');
        setLoading(false);
        return;
      }

      if (data.success) {
        onLogin(data.accessToken, data.user);
      } else if (data.mfaRequired) {
        setShowMfa(true);
        setTempUserId(data.userId);
        toast.info('MFA is required. Please enter your 6-digit code from Google Authenticator');
        setLoading(false);
        return;
      } else {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
    } catch (err: any) {
      console.error('Login error:', err);
      // Show more specific error messages
      if (err.message && err.message.includes('fetch')) {
        setError('Cannot connect to server. Please check if the backend is running on http://localhost:3000');
      } else if (err.message) {
        setError(`Error: ${err.message}`);
      } else {
        setError('Network error. Please check browser console (F12) for details.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-slate-900">SEPBAS</h1>
            <p className="text-slate-600">Secure Employee Promotion & Bonus Approval System</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-slate-200">
          <CardHeader>
            <CardTitle>{showMfa ? 'Two-Factor Authentication' : 'Sign In'}</CardTitle>
            <CardDescription>
              {showMfa 
                ? 'Enter the 6-digit code from Google Authenticator'
                : 'Enter your credentials to access the system'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {!showMfa ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@aastu.edu.et"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {qrCodeUrl && (
                    <div className="space-y-2">
                      <Label>Scan QR Code with Google Authenticator</Label>
                      <div className="flex justify-center p-4 bg-white border border-slate-200 rounded">
                        <img src={qrCodeUrl} alt="MFA QR Code" className="w-48 h-48" />
                      </div>
                      <p className="text-sm text-slate-600 text-center">
                        Scan this QR code with Google Authenticator app to get your 6-digit code
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="mfa">MFA Code (6 digits)</Label>
                    <Input
                      id="mfa"
                      type="text"
                      placeholder="000000"
                      value={mfaToken}
                      onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      disabled={loading}
                      maxLength={6}
                      className="text-center tracking-widest text-2xl"
                    />
                    <p className="text-sm text-slate-600">
                      {qrCodeUrl 
                        ? 'Enter the 6-digit code from Google Authenticator'
                        : 'Open Google Authenticator app and enter the 6-digit code'}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : showMfa ? 'Verify & Sign In' : 'Sign In'}
              </Button>

              {showMfa && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowMfa(false);
                    setMfaToken('');
                    setError('');
                  }}
                  disabled={loading}
                >
                  Back to Login
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Security Features Info */}
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle>Security Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-slate-900">Multi-Factor Authentication</p>
                <p className="text-slate-600">Required for Manager+ roles</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-slate-900">Time-Based Access Control</p>
                <p className="text-slate-600">Mon-Fri, 08:00-18:00 EAT</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-slate-900">Account Lockout Protection</p>
                <p className="text-slate-600">15-minute lockout after 5 failed attempts</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-slate-900">Comprehensive Audit Logging</p>
                <p className="text-slate-600">All actions tracked and encrypted</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demo Credentials */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle>Demo Access</CardTitle>
            <CardDescription>Contact system administrator for credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">
              New users must be registered by a system administrator to ensure proper role assignment 
              and security clearance levels.
            </p>
          </CardContent>
        </Card>

        {/* University Info */}
        <div className="text-center text-slate-600 pt-4">
          <p>Addis Ababa Science and Technology University</p>
          <p className="text-slate-500">Department of Software Engineering</p>
        </div>
      </div>
    </div>
  );
}
