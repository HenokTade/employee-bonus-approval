/**
 * SEPBAS Frontend Application
 * Vanilla JavaScript implementation
 */

const API_BASE = '/api';
let currentUser = null;
let accessToken = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Check for existing session
    const savedToken = localStorage.getItem('sepbas_token');
    const savedUser = localStorage.getItem('sepbas_user');
    
    if (savedToken && savedUser) {
        accessToken = savedToken;
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }
});

// Login function
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showAlert('Please enter email and password', 'danger');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            showAlert(data.error || 'Login failed', 'danger');
            return;
        }
        
        if (data.mfaRequired) {
            // Show MFA form
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('mfaForm').classList.remove('hidden');
            return;
        }
        
        if (data.success) {
            accessToken = data.accessToken;
            currentUser = data.user;
            localStorage.setItem('sepbas_token', accessToken);
            localStorage.setItem('sepbas_user', JSON.stringify(currentUser));
            showDashboard();
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert('Network error. Please try again.', 'danger');
    }
}

// MFA verification
async function verifyMFA() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const mfaToken = document.getElementById('mfaToken').value;
    
    if (!mfaToken || mfaToken.length !== 6) {
        showAlert('Please enter a valid 6-digit code', 'danger');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, mfaToken })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            showAlert(data.error || 'MFA verification failed', 'danger');
            return;
        }
        
        if (data.success) {
            accessToken = data.accessToken;
            currentUser = data.user;
            localStorage.setItem('sepbas_token', accessToken);
            localStorage.setItem('sepbas_user', JSON.stringify(currentUser));
            showDashboard();
        }
    } catch (error) {
        console.error('MFA error:', error);
        showAlert('Network error. Please try again.', 'danger');
    }
}

// Back to login
function backToLogin() {
    document.getElementById('mfaForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('mfaToken').value = '';
}

// Show dashboard
function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.remove('hidden');
    
    // Update user info
    document.getElementById('userInfo').innerHTML = `
        <strong>${currentUser.name}</strong><br>
        <small>${currentUser.role.replace('_', ' ').toUpperCase()}</small>
    `;
    
    // Show/hide admin panel
    if (currentUser.role === 'hr_admin' || currentUser.role === 'system_admin') {
        document.getElementById('adminPanel').classList.remove('hidden');
        loadUsers();
    }
    
    // Show/hide create nomination for managers
    if (currentUser.role === 'manager') {
        document.getElementById('createNominationSection').classList.remove('hidden');
    }
    
    // Load data
    loadNominations();
    loadStats();
}

// Logout
async function logout() {
    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    accessToken = null;
    currentUser = null;
    localStorage.removeItem('sepbas_token');
    localStorage.removeItem('sepbas_user');
    
    document.getElementById('dashboardScreen').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
}

// Load nominations
async function loadNominations() {
    try {
        const response = await fetch(`${API_BASE}/nominations`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayNominations(data.nominations);
        }
    } catch (error) {
        console.error('Load nominations error:', error);
    }
}

// Display nominations
function displayNominations(nominations) {
    const container = document.getElementById('nominationsContainer');
    
    if (nominations.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-muted">No nominations yet</div>';
        return;
    }
    
    container.innerHTML = nominations.map(nom => `
        <div class="nomination-card">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h5>${nom.employee_name}</h5>
                    <p class="mb-2">
                        ${nom.type === 'bonus' ? `Bonus: ${nom.bonus_amount.toLocaleString()} ETB` : `Promotion to: ${nom.promotion_to}`}
                    </p>
                    <p class="text-muted">${nom.justification}</p>
                </div>
                <span class="badge bg-${getStatusColor(nom.status)}">${nom.status.replace('_', ' ')}</span>
            </div>
            <div class="mt-2">
                <small class="text-muted">By ${nom.manager_name} on ${new Date(nom.created_at).toLocaleDateString()}</small>
            </div>
        </div>
    `).join('');
}

// Get status color
function getStatusColor(status) {
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'danger';
    return 'warning';
}

// Load stats
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/nominations`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const nominations = data.nominations;
            const pending = nominations.filter(n => n.status.startsWith('pending')).length;
            const approved = nominations.filter(n => n.status === 'approved').length;
            
            document.getElementById('statsContainer').innerHTML = `
                <div class="col-md-4">
                    <div class="stat-card">
                        <h3>${pending}</h3>
                        <p>Pending Approvals</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stat-card">
                        <h3>${approved}</h3>
                        <p>Approved</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stat-card">
                        <h3>${nominations.length}</h3>
                        <p>Total Nominations</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// Load users (admin)
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayUsers(data.users);
        }
    } catch (error) {
        console.error('Load users error:', error);
    }
}

// Display users
function displayUsers(users) {
    const container = document.getElementById('usersContainer');
    container.innerHTML = users.map(user => `
        <div class="card mb-2">
            <div class="card-body">
                <h6>${user.name}</h6>
                <p class="mb-0">${user.email} - <span class="badge bg-secondary">${user.role.replace('_', ' ')}</span></p>
            </div>
        </div>
    `).join('');
}

// Show alert
function showAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    container.appendChild(alert);
    
    setTimeout(() => alert.remove(), 5000);
}

// Show register modal
function showRegisterModal() {
    const modal = new bootstrap.Modal(document.getElementById('registerModal'));
    modal.show();
}

// Register user (admin only)
async function registerUser() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    const department = document.getElementById('regDepartment').value;
    
    if (!name || !email || !password || !role || !department) {
        showAlert('Please fill in all fields', 'danger');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name, email, password, role, department,
                adminToken: 'ADMIN_REGISTRATION_TOKEN'
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert(data.message || 'User registered successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
            loadUsers();
        } else {
            showAlert(data.error || 'Registration failed', 'danger');
        }
    } catch (error) {
        console.error('Register error:', error);
        showAlert('Network error. Please try again.', 'danger');
    }
}

// Load audit logs
async function loadAuditLogs() {
    try {
        const response = await fetch(`${API_BASE}/admin/logs`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayLogs(data.logs);
        }
    } catch (error) {
        console.error('Load logs error:', error);
    }
}

// Display logs
function displayLogs(logs) {
    const container = document.getElementById('logsContainer');
    container.innerHTML = logs.slice(0, 100).map(log => `
        <div class="card mb-2">
            <div class="card-body">
                <strong>${log.user_name || 'System'}</strong> - ${log.action}
                <br><small class="text-muted">${new Date(log.timestamp).toLocaleString()}</small>
            </div>
        </div>
    `).join('');
}

// Toggle nomination type
function toggleNominationType() {
    const type = document.getElementById('nominationType').value;
    document.getElementById('bonusAmountDiv').classList.toggle('hidden', type === 'promotion');
    document.getElementById('promotionToDiv').classList.toggle('hidden', type === 'bonus');
}

