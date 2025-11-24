import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { User } from '../App';
import { Users, FileText, Download, UserPlus, Shield, Clock } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  clearanceLevel: number;
  afterHoursAccess: boolean;
  mfaEnabled: boolean;
  createdAt: string;
}

interface AuditLog {
  userId: string;
  userName: string;
  action: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

interface AdminPanelProps {
  user: User;
  accessToken: string;
}

export function AdminPanel({ user, accessToken }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Registration form
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState('employee');
  const [regDepartment, setRegDepartment] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  // Edit form
  const [editClearance, setEditClearance] = useState(1);
  const [editAfterHours, setEditAfterHours] = useState(false);
  const [editRole, setEditRole] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchLogs();
  }, []);

  const fetchUsers = async () => {
    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(
        `${API_BASE_URL}/admin/users`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Transform snake_case to camelCase
        const transformed = data.users.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          department: u.department,
          clearanceLevel: u.clearance_level,
          afterHoursAccess: u.after_hours_access,
          mfaEnabled: u.mfa_enabled,
          createdAt: u.created_at,
        }));
        setUsers(transformed);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error('Network error while fetching users');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(
        `${API_BASE_URL}/admin/logs`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Transform snake_case to camelCase
        const transformed = data.logs.map((log: any) => ({
          userId: log.user_id,
          userName: log.user_name,
          action: log.action,
          details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details),
          ipAddress: log.ip_address,
          timestamp: log.timestamp,
        }));
        setLogs(transformed);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to fetch logs');
      }
    } catch (error) {
      console.error('Fetch logs error:', error);
      toast.error('Network error while fetching logs');
    }
  };

  const handleRegister = async () => {
    if (!regEmail || !regPassword || !regName || !regRole || !regDepartment) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(
        `${API_BASE_URL}/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: regEmail,
            password: regPassword,
            name: regName,
            role: regRole,
            department: regDepartment,
            adminToken: 'ADMIN_REGISTRATION_TOKEN',
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        
        if (data.qrCodeUrl) {
          setQrCodeUrl(data.qrCodeUrl);
        } else {
          setRegisterDialogOpen(false);
          resetRegForm();
          fetchUsers();
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Register error:', error);
      toast.error('Network error while registering user');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(
        `${API_BASE_URL}/admin/users/${selectedUser.id}/update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            clearanceLevel: editClearance,
            afterHoursAccess: editAfterHours,
            role: editRole,
          }),
        }
      );

      if (response.ok) {
        toast.success('User updated successfully');
        setEditDialogOpen(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Update user error:', error);
      toast.error('Network error while updating user');
    }
  };

  const handleBackup = async () => {
    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(
        `${API_BASE_URL}/admin/backup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Download backup as JSON
        const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sepbas-backup-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        toast.success('Backup created successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create backup');
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('Network error while creating backup');
    }
  };

  const resetRegForm = () => {
    setRegEmail('');
    setRegPassword('');
    setRegName('');
    setRegRole('employee');
    setRegDepartment('');
    setQrCodeUrl('');
  };

  const openEditDialog = (u: AdminUser) => {
    setSelectedUser(u);
    setEditClearance(u.clearanceLevel);
    setEditAfterHours(u.afterHoursAccess);
    setEditRole(u.role);
    setEditDialogOpen(true);
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      employee: 'bg-slate-100 text-slate-800',
      manager: 'bg-blue-100 text-blue-800',
      dept_head: 'bg-purple-100 text-purple-800',
      hr_admin: 'bg-green-100 text-green-800',
      system_admin: 'bg-red-100 text-red-800',
    };

    return (
      <Badge variant="outline" className={colors[role] || colors.employee}>
        {role.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Total Users</CardTitle>
            <Users className="h-5 w-5 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{users.length}</div>
            <p className="text-slate-600">Registered in system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Audit Logs</CardTitle>
            <FileText className="h-5 w-5 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{logs.length}</div>
            <p className="text-slate-600">Total events logged</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>After-Hours Access</CardTitle>
            <Clock className="h-5 w-5 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{users.filter(u => u.afterHoursAccess).length}</div>
            <p className="text-slate-600">Users with extended access</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="backup">Backup & Security</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={registerDialogOpen} onOpenChange={(open) => {
              setRegisterDialogOpen(open);
              if (!open) {
                resetRegForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Register New User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Register New User</DialogTitle>
                  <DialogDescription>
                    Create a new user account with appropriate role and permissions
                  </DialogDescription>
                </DialogHeader>

                {!qrCodeUrl ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          placeholder="John Doe"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          placeholder="user@aastu.edu.et"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        placeholder="Min 8 chars, 1 uppercase, 1 digit, 1 special"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                      />
                      <p className="text-slate-600">
                        Password must have at least 8 characters, 1 uppercase letter, 1 digit, and 1 special character
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={regRole} onValueChange={setRegRole}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="dept_head">Department Head</SelectItem>
                            <SelectItem value="hr_admin">HR Admin</SelectItem>
                            {user.role === 'system_admin' && (
                              <SelectItem value="system_admin">System Admin</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Select value={regDepartment} onValueChange={setRegDepartment}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Engineering">Engineering</SelectItem>
                            <SelectItem value="Sales">Sales</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="HR">HR</SelectItem>
                            <SelectItem value="Finance">Finance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {['manager', 'dept_head', 'hr_admin', 'system_admin'].includes(regRole) && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-blue-900 flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          This role requires Multi-Factor Authentication (MFA)
                        </p>
                        <p className="text-blue-700 mt-1">
                          A QR code will be generated for Google Authenticator setup
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setRegisterDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleRegister}>
                        Register User
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded p-4 text-center">
                      <h3 className="text-green-900 mb-2">User Registered Successfully!</h3>
                      <p className="text-green-700">
                        Have the user scan this QR code with Google Authenticator
                      </p>
                    </div>

                    <div className="flex justify-center p-4 bg-white border border-slate-200 rounded">
                      <img src={qrCodeUrl} alt="MFA QR Code" className="w-64 h-64" />
                    </div>

                    <div className="text-center space-y-2">
                      <p className="text-slate-700">User: {regEmail}</p>
                      <p className="text-slate-600">Save this QR code and share it securely with the user</p>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => {
                        setRegisterDialogOpen(false);
                        resetRegForm();
                        fetchUsers();
                      }}
                    >
                      Done
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage user roles and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-slate-900">{u.name}</p>
                        {getRoleBadge(u.role)}
                        {u.mfaEnabled && (
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                            MFA
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-600">{u.email}</p>
                      <div className="flex items-center gap-4 text-slate-500">
                        <span>Dept: {u.department}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Clearance L{u.clearanceLevel}
                        </span>
                        {u.afterHoursAccess && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-amber-600">
                              <Clock className="w-3 h-3" />
                              After-Hours Access
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(u)}>
                      Edit Permissions
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>Complete log of all system actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {logs.map((log, idx) => (
                  <div key={idx} className="p-3 border border-slate-200 rounded hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-slate-900">{log.userName || 'Unknown User'}</p>
                          <Badge variant="outline">{log.action}</Badge>
                        </div>
                        {log.details && log.details !== '{}' && (
                          <p className="text-slate-600 font-mono">{log.details}</p>
                        )}
                        <div className="flex items-center gap-2 text-slate-500">
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                          <span>•</span>
                          <span>IP: {log.ipAddress}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No audit logs yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Backup</CardTitle>
              <CardDescription>Export encrypted backup of all system data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded p-4">
                <h4 className="text-slate-900 mb-2">Backup Includes:</h4>
                <ul className="space-y-1 text-slate-600">
                  <li>• All user accounts (passwords and MFA secrets redacted)</li>
                  <li>• All nominations and approval history</li>
                  <li>• Complete audit logs</li>
                  <li>• Timestamp and metadata</li>
                </ul>
              </div>

              {user.role === 'system_admin' && (
                <Button onClick={handleBackup} className="w-full gap-2">
                  <Download className="w-4 h-4" />
                  Create & Download Backup
                </Button>
              )}

              {user.role !== 'system_admin' && (
                <p className="text-amber-600">Only System Administrators can create backups</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Information</CardTitle>
              <CardDescription>Access control models implemented</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <h4 className="text-slate-900">RBAC - Role-Based Access Control</h4>
                <p className="text-slate-600">Users assigned roles (Employee, Manager, Dept Head, HR Admin, System Admin) with specific permissions</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-slate-900">MAC - Mandatory Access Control</h4>
                <p className="text-slate-600">Data labeled by sensitivity (Public, Internal, Confidential). Users need appropriate clearance level to access</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-slate-900">DAC - Discretionary Access Control</h4>
                <p className="text-slate-600">Resource owners can grant view/edit permissions to specific users</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-slate-900">RuBAC - Rule-Based Access Control</h4>
                <p className="text-slate-600">Time-based rules: Access restricted to Mon-Fri 08:00-18:00 unless "After-Hours Access" granted</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-slate-900">ABAC - Attribute-Based Access Control</h4>
                <p className="text-slate-600">Dynamic policies based on user attributes, resource properties, and environmental conditions</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Permissions</DialogTitle>
            <DialogDescription>
              Update security clearance and access rules for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="dept_head">Department Head</SelectItem>
                  <SelectItem value="hr_admin">HR Admin</SelectItem>
                  {user.role === 'system_admin' && (
                    <SelectItem value="system_admin">System Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {user.role === 'system_admin' && (
              <div className="space-y-2">
                <Label>MAC Clearance Level</Label>
                <Select value={editClearance.toString()} onValueChange={(v) => setEditClearance(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1 - Public</SelectItem>
                    <SelectItem value="2">Level 2 - Internal</SelectItem>
                    <SelectItem value="3">Level 3 - Confidential</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-slate-600">Only System Admin can modify clearance levels</p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 border border-slate-200 rounded">
              <div className="space-y-1">
                <Label>After-Hours Access (RuBAC)</Label>
                <p className="text-slate-600">Allow access outside Mon-Fri 08:00-18:00 EAT</p>
              </div>
              <Switch
                checked={editAfterHours}
                onCheckedChange={setEditAfterHours}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUser}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
