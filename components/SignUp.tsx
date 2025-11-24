import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { toast } from 'sonner';

interface SignUpProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function SignUp({ onBack, onSuccess }: SignUpProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: 'employee' as 'employee' | 'manager' | 'dept_head' | 'hr_admin' | 'system_admin',
    department: '',
    adminToken: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter, one digit, and one special character');
      return;
    }

    if (!formData.adminToken) {
      setError('Admin registration token is required');
      return;
    }

    setLoading(true);

    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          department: formData.department,
          adminToken: formData.adminToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // If MFA is required, show QR code
      if (data.mfaRequired && data.qrCodeUrl) {
        setQrCodeUrl(data.qrCodeUrl);
        setRegistrationSuccess(true);
        toast.success('User registered successfully! Please scan the QR code for MFA setup.');
      } else {
        setRegistrationSuccess(true);
        toast.success('User registered successfully!');
      }

      setLoading(false);
    } catch (err) {
      console.error('Registration error:', err);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-green-600">Registration Successful!</CardTitle>
            <CardDescription>
              {qrCodeUrl 
                ? 'User has been registered. Please scan the QR code with Google Authenticator for MFA setup.'
                : 'User has been registered successfully.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrCodeUrl && (
              <div className="flex justify-center p-4 bg-white border border-slate-200 rounded">
                <img src={qrCodeUrl} alt="MFA QR Code" className="w-64 h-64" />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                {qrCodeUrl 
                  ? 'Scan this QR code with Google Authenticator app on your phone, then you can login.'
                  : 'You can now login with the registered credentials.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={onBack} variant="outline" className="flex-1">
                Back to Landing
              </Button>
              <Button onClick={onSuccess} className="flex-1">
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-slate-200">
        <CardHeader>
          <CardTitle>Register New User</CardTitle>
          <CardDescription>
            Only system administrators can register new users. You need an admin registration token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@aastu.edu.et"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
              />
              <p className="text-xs text-slate-500">
                Must be at least 8 characters with uppercase, digit, and special character
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                required
                disabled={loading}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="dept_head">Department Head</option>
                <option value="hr_admin">HR Admin</option>
                <option value="system_admin">System Admin</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                type="text"
                placeholder="Engineering, HR, Finance, etc."
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminToken">Admin Registration Token</Label>
              <Input
                id="adminToken"
                type="text"
                placeholder="ADMIN_REGISTRATION_TOKEN"
                value={formData.adminToken}
                onChange={(e) => setFormData({ ...formData, adminToken: e.target.value })}
                required
                disabled={loading}
              />
              <p className="text-xs text-slate-500">
                Required token for user registration. Contact system administrator.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onBack} className="flex-1" disabled={loading}>
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

