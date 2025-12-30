import { useState, useEffect } from 'react';
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

interface CaptchaData {
  captchaId: string;
  question: string;
}

export function SignUp({ onBack, onSuccess }: SignUpProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    role: 'employee' as 'employee' | 'manager' | 'dept_head' | 'hr_admin' | 'system_admin',
    department: '',
    adminToken: '',
    captchaAnswer: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  // Fetch CAPTCHA and Departments on component mount
  useEffect(() => {
    fetchCaptcha();
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(`${API_BASE_URL}/departments`);
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
      // Fallback to defaults if API fails
      setDepartments(['Electrical and Mechanical', 'Civil and Architecture', 'Social Engineering']);
    }
  };

  const fetchCaptcha = async () => {
    setLoadingCaptcha(true);
    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(`${API_BASE_URL}/auth/captcha`);

      if (!response.ok) {
        throw new Error(`Failed to fetch CAPTCHA: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setCaptcha({ captchaId: data.captchaId, question: data.question });
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('CAPTCHA fetch error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to load CAPTCHA';
      setError(`CAPTCHA Error: ${errorMsg}. Please check if backend is running on http://localhost:3000`);
    } finally {
      setLoadingCaptcha(false);
    }
  };

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

    if (!captcha || !formData.captchaAnswer) {
      setError('Please solve the CAPTCHA');
      return;
    }

    // Validate phone number format (optional but if provided, should be valid)
    if (formData.phone && !/^\+?[1-9]\d{1,14}$/.test(formData.phone.replace(/\s/g, ''))) {
      setError('Please enter a valid phone number (e.g., +251912345678)');
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
          phone: formData.phone || undefined,
          role: formData.role,
          department: formData.department,
          adminToken: formData.adminToken,
          captchaId: captcha.captchaId,
          captchaAnswer: formData.captchaAnswer,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        setError(`Server error: ${response.status} ${response.statusText}`);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        // Show detailed error message
        const errorMsg = data.error || data.details?.[0]?.msg || 'Registration failed';
        setError(errorMsg);
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
      // Show more specific error messages
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Cannot connect to server. Please check if the backend is running on http://localhost:3000');
      } else if (err instanceof Error) {
        setError(`Error: ${err.message}`);
      } else {
        setError('Network error. Please try again. Check browser console for details.');
      }
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
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+251912345678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={loading}
              />
              <p className="text-xs text-slate-500">
                Include country code (e.g., +251 for Ethiopia)
              </p>
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
              <select
                id="department"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                required
                disabled={loading}
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
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

            <div className="space-y-2">
              <Label htmlFor="captcha">CAPTCHA Verification</Label>
              {loadingCaptcha ? (
                <p className="text-sm text-slate-500">Loading CAPTCHA...</p>
              ) : captcha ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
                    <span className="text-lg font-semibold">{captcha.question}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={fetchCaptcha}
                      className="text-xs"
                      disabled={loading}
                    >
                      Refresh
                    </Button>
                  </div>
                  <Input
                    id="captchaAnswer"
                    type="number"
                    placeholder="Enter answer"
                    value={formData.captchaAnswer}
                    onChange={(e) => setFormData({ ...formData, captchaAnswer: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">Failed to load CAPTCHA. Please refresh the page.</p>
                </div>
              )}
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

