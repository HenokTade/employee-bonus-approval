import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { User } from '../App';
import { AlertCircle, CheckCircle2, Clock, TrendingUp, Award, Shield } from 'lucide-react';

interface Nomination {
  id: string;
  employeeId: string;
  employeeName: string;
  managerId: string;
  managerName: string;
  department: string;
  type: 'bonus' | 'promotion';
  bonusAmount: number;
  promotionTo: string | null;
  justification: string;
  status: string;
  macLabel: number;
  ownerId: string;
  dacPermissions: Record<string, string>;
  level1ApprovedBy: string | null;
  level2ApprovedBy: string | null;
  level3ApprovedBy: string | null;
  createdAt: string;
  updatedAt: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

interface DashboardProps {
  user: User;
  accessToken: string;
}

export function Dashboard({ user, accessToken }: DashboardProps) {
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [nominationType, setNominationType] = useState<'bonus' | 'promotion'>('bonus');
  const [bonusAmount, setBonusAmount] = useState('');
  const [promotionTo, setPromotionTo] = useState('');
  const [justification, setJustification] = useState('');

  useEffect(() => {
    fetchNominations();
    if (user.role === 'manager' || user.role === 'hr_admin' || user.role === 'system_admin') {
      fetchUsers();
    }
  }, []);

  // Refetch users when dialog opens if list is empty
  useEffect(() => {
    if (createDialogOpen && (user.role === 'manager' || user.role === 'hr_admin' || user.role === 'system_admin')) {
      // Only fetch if we don't have users and we're not already loading
      if (allUsers.length === 0 && !loadingUsers) {
        fetchUsers();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createDialogOpen]);

  const fetchNominations = async () => {
    try {
      const { API_BASE_URL } = await import('../config/api');
      const url = `${API_BASE_URL}/nominations`;
      console.log('Fetching nominations from:', url);
      const response = await fetch(
        url,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Transform snake_case to camelCase
        const transformed = data.nominations.map((nom: any) => ({
          id: nom.id,
          employeeId: nom.employee_id,
          employeeName: nom.employee_name,
          managerId: nom.manager_id,
          managerName: nom.manager_name,
          department: nom.department,
          type: nom.type,
          bonusAmount: nom.bonus_amount,
          promotionTo: nom.promotion_to,
          justification: nom.justification,
          status: nom.status,
          macLabel: nom.mac_label,
          ownerId: nom.owner_id,
          dacPermissions: nom.dac_permissions || {},
          level1ApprovedBy: nom.level1_approved_by,
          level2ApprovedBy: nom.level2_approved_by,
          level3ApprovedBy: nom.level3_approved_by,
          createdAt: nom.created_at,
          updatedAt: nom.updated_at,
          rejectedBy: nom.rejected_by,
          rejectionReason: nom.rejection_reason,
        }));
        setNominations(transformed);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to fetch nominations');
      }
    } catch (error) {
      console.error('Fetch nominations error:', error);
      toast.error('Network error while fetching nominations');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { API_BASE_URL } = await import('../config/api');
      
      // Debug: Log user info
      console.log('Fetching users for:', {
        role: user.role,
        department: user.department,
        userId: user.id
      });
      
      // If manager, request department employees explicitly (backend enforces permissions)
      const url = user.role === 'manager'
        ? `${API_BASE_URL}/departments/${encodeURIComponent(user.department)}/employees`
        : `${API_BASE_URL}/admin/users`;

      const response = await fetch(url,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Received users from API:', data.users.length);
        
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
        
        console.log('All transformed users:', transformed);
        console.log('Manager department:', user.department);
        
        // Server returns users already restricted; pick employees only
        const employees = transformed.filter((u: any) => u.role === 'employee');
        setAllUsers(employees);
        
        if (employees.length === 0) {
          if (user.role === 'manager') {
            console.warn(`No employees found in department: ${user.department}`);
            console.warn('Available departments in system:', [...new Set(transformed.map((u: any) => u.department))]);
            toast.warning(`No employees found in your department (${user.department}). Please contact an administrator.`);
          } else {
            console.warn('No employees found in the system');
            toast.warning('No employees found in the system. Please contact an administrator.');
          }
        } else {
          console.log(`Loaded ${employees.length} employees for nomination${user.role === 'manager' ? ` from department: ${user.department}` : ''}`);
        }
      } else {
        const error = await response.json();
        console.error('Failed to fetch users:', error);
        toast.error(error.error || 'Failed to load employees. Please refresh the page.');
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error('Network error while loading employees. Please check your connection.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateNomination = async () => {
    if (!selectedEmployee || !justification) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (nominationType === 'bonus' && (!bonusAmount || parseFloat(bonusAmount) <= 0)) {
      toast.error('Please enter a valid bonus amount');
      return;
    }

    if (nominationType === 'promotion' && !promotionTo) {
      toast.error('Please specify the promotion position');
      return;
    }

    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(
        `${API_BASE_URL}/nominations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
            body: JSON.stringify({
            employeeId: Number(selectedEmployee),
            type: nominationType,
            bonusAmount: nominationType === 'bonus' ? parseFloat(bonusAmount) : 0,
            promotionTo: nominationType === 'promotion' ? promotionTo : null,
            justification,
          }),
        }
      );

      if (response.ok) {
        toast.success('Nomination created successfully');
        setCreateDialogOpen(false);
        resetForm();
        fetchNominations();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create nomination');
      }
    } catch (error) {
      console.error('Create nomination error:', error);
      toast.error('Network error while creating nomination');
    }
  };

  const handleApprove = async (nominationId: string) => {
    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(
        `${API_BASE_URL}/nominations/${nominationId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        toast.success('Nomination approved');
        fetchNominations();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to approve nomination');
      }
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Network error while approving');
    }
  };

  const handleReject = async (nominationId: string, reason: string) => {
    if (!reason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      const { API_BASE_URL } = await import('../config/api');
      const response = await fetch(
        `${API_BASE_URL}/nominations/${nominationId}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ reason }),
        }
      );

      if (response.ok) {
        toast.success('Nomination rejected');
        fetchNominations();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to reject nomination');
      }
    } catch (error) {
      console.error('Reject error:', error);
      toast.error('Network error while rejecting');
    }
  };

  const resetForm = () => {
    setSelectedEmployee('');
    setNominationType('bonus');
    setBonusAmount('');
    setPromotionTo('');
    setJustification('');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      pending_manager: { variant: 'secondary', icon: Clock, label: 'Pending Manager' },
      pending_dept_head: { variant: 'secondary', icon: Clock, label: 'Pending Dept Head' },
      pending_hr: { variant: 'secondary', icon: Clock, label: 'Pending HR' },
      approved: { variant: 'default', icon: CheckCircle2, label: 'Approved' },
      rejected: { variant: 'destructive', icon: AlertCircle, label: 'Rejected' },
    };

    const config = statusConfig[status] || statusConfig.pending_manager;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getMacLabelBadge = (label: number) => {
    const labels = {
      1: { text: 'Public', className: 'bg-green-100 text-green-800 border-green-200' },
      2: { text: 'Internal', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      3: { text: 'Confidential', className: 'bg-red-100 text-red-800 border-red-200' },
    };

    const config = labels[label as keyof typeof labels] || labels[1];

    return (
      <Badge variant="outline" className={config.className}>
        <Shield className="w-3 h-3 mr-1" />
        {config.text}
      </Badge>
    );
  };

  const canApprove = (nomination: Nomination) => {
    if (nomination.status === 'pending_manager' && user.role === 'manager') return true;
    if (nomination.status === 'pending_dept_head' && user.role === 'dept_head') return true;
    if (nomination.status === 'pending_hr' && user.role === 'hr_admin') return true;
    return false;
  };

  const canReject = (nomination: Nomination) => {
    return ['manager', 'dept_head', 'hr_admin'].includes(user.role) && 
           !['approved', 'rejected'].includes(nomination.status);
  };

  const pendingNominations = nominations.filter(n => n.status.startsWith('pending'));
  const completedNominations = nominations.filter(n => n.status === 'approved' || n.status === 'rejected');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading dashboard...</p>
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
            <CardTitle>Pending Approvals</CardTitle>
            <Clock className="h-5 w-5 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{pendingNominations.length}</div>
            <p className="text-slate-600">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Approved</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{nominations.filter(n => n.status === 'approved').length}</div>
            <p className="text-slate-600">Successfully processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Total Nominations</CardTitle>
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{nominations.length}</div>
            <p className="text-slate-600">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {user.role === 'manager' && (
        <div className="flex justify-end">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Award className="w-4 h-4" />
                Create Nomination
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Nomination</DialogTitle>
                <DialogDescription>
                  Nominate an employee for a bonus or promotion
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  {loadingUsers ? (
                    <div className="flex items-center gap-2 text-slate-600">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading employees...</span>
                    </div>
                  ) : allUsers.length === 0 ? (
                    <div className="text-amber-600 text-sm">
                      No employees available. Please contact an administrator.
                    </div>
                  ) : (
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {allUsers.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.name} - {u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={nominationType} onValueChange={(v: any) => setNominationType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bonus">Bonus</SelectItem>
                      <SelectItem value="promotion">Promotion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {nominationType === 'bonus' && (
                  <div className="space-y-2">
                    <Label>Bonus Amount (ETB)</Label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={bonusAmount}
                      onChange={(e) => setBonusAmount(e.target.value)}
                      min="0"
                      step="1000"
                    />
                    {parseFloat(bonusAmount) > 50000 && (
                      <p className="text-amber-600 flex items-center gap-1">
                        <Shield className="w-4 h-4" />
                        High-value bonus requires Confidential clearance
                      </p>
                    )}
                  </div>
                )}

                {nominationType === 'promotion' && (
                  <div className="space-y-2">
                    <Label>Promotion To</Label>
                    <Input
                      placeholder="Senior Software Engineer"
                      value={promotionTo}
                      onChange={(e) => setPromotionTo(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Justification</Label>
                  <Textarea
                    placeholder="Explain why this employee deserves this nomination..."
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateNomination}>
                    Submit Nomination
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Pending Nominations */}
      {pendingNominations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Nominations</CardTitle>
            <CardDescription>Nominations awaiting approval</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingNominations.map((nomination) => (
              <NominationCard
                key={nomination.id}
                nomination={nomination}
                user={user}
                canApprove={canApprove(nomination)}
                canReject={canReject(nomination)}
                onApprove={() => handleApprove(nomination.id)}
                onReject={(reason) => handleReject(nomination.id, reason)}
                getStatusBadge={getStatusBadge}
                getMacLabelBadge={getMacLabelBadge}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Completed Nominations */}
      {completedNominations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Nominations</CardTitle>
            <CardDescription>Approved and rejected nominations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {completedNominations.map((nomination) => (
              <NominationCard
                key={nomination.id}
                nomination={nomination}
                user={user}
                canApprove={false}
                canReject={false}
                onApprove={() => {}}
                onReject={() => {}}
                getStatusBadge={getStatusBadge}
                getMacLabelBadge={getMacLabelBadge}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {nominations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">No nominations yet</p>
            {user.role === 'manager' && (
              <p className="text-slate-500 mt-2">Create your first nomination to get started</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NominationCard({
  nomination,
  user,
  canApprove,
  canReject,
  onApprove,
  onReject,
  getStatusBadge,
  getMacLabelBadge,
}: {
  nomination: Nomination;
  user: User;
  canApprove: boolean;
  canReject: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  getMacLabelBadge: (label: number) => React.ReactNode;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-slate-900">{nomination.employeeName}</h4>
            <Badge variant="outline">{nomination.department}</Badge>
          </div>
          <p className="text-slate-600">
            {nomination.type === 'bonus' 
              ? `Bonus: ${nomination.bonusAmount.toLocaleString()} ETB`
              : `Promotion to: ${nomination.promotionTo}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(nomination.status)}
          {getMacLabelBadge(nomination.macLabel)}
        </div>
      </div>

      <div className="bg-slate-50 rounded p-3">
        <p className="text-slate-900 mb-1">Justification:</p>
        <p className="text-slate-600">{nomination.justification}</p>
      </div>

      <div className="flex items-center gap-4 text-slate-600">
        <span>Manager: {nomination.managerName}</span>
        <span>•</span>
        <span>{new Date(nomination.createdAt).toLocaleDateString()}</span>
      </div>

      {nomination.status === 'rejected' && nomination.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-red-900 mb-1">Rejection Reason:</p>
          <p className="text-red-700">{nomination.rejectionReason}</p>
        </div>
      )}

      {(canApprove || canReject) && (
        <div className="flex gap-2 pt-2">
          {canApprove && (
            <Button onClick={onApprove} size="sm" className="gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Approve
            </Button>
          )}
          {canReject && (
            <>
              <Button
                onClick={() => setShowRejectDialog(true)}
                variant="destructive"
                size="sm"
                className="gap-1"
              >
                <AlertCircle className="w-4 h-4" />
                Reject
              </Button>

              <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject Nomination</DialogTitle>
                    <DialogDescription>
                      Please provide a reason for rejecting this nomination
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Explain why this nomination is being rejected..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={4}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          onReject(rejectReason);
                          setShowRejectDialog(false);
                          setRejectReason('');
                        }}
                      >
                        Confirm Rejection
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      )}
    </div>
  );
}
