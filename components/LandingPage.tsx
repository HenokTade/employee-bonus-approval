import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface LandingPageProps {
  onNavigateToLogin: () => void;
  onNavigateToSignup: () => void;
}

export function LandingPage({ onNavigateToLogin, onNavigateToSignup }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>

          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            SEPBAS
          </h1>
          <p className="text-2xl text-slate-600 mb-2">
            Secure Employee Promotion & Bonus Approval System
          </p>
          <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto">
            A comprehensive enterprise system demonstrating advanced access control models, 
            multi-factor authentication, and comprehensive security features for managing 
            employee promotions and bonus approvals.
          </p>

          {/* CTA Buttons */}
          <div className="flex gap-4 justify-center mb-16">
            <Button 
              onClick={onNavigateToLogin}
              size="lg"
              className="px-8 py-6 text-lg bg-blue-600 hover:bg-blue-700"
            >
              Sign In
            </Button>
            <Button 
              onClick={onNavigateToSignup}
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg border-2"
            >
              Register New User
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-20">
          {/* Feature 1 */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <CardTitle>5 Access Control Models</CardTitle>
              <CardDescription>
                RBAC, MAC, DAC, RuBAC, and ABAC working together to provide comprehensive security
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 2 */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <CardTitle>Multi-Factor Authentication</CardTitle>
              <CardDescription>
                TOTP-based MFA with Google Authenticator for enhanced security
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 3 */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <CardTitle>Comprehensive Audit Logging</CardTitle>
              <CardDescription>
                Every action tracked with IP addresses, timestamps, and detailed logs
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 4 */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <CardTitle>Time-Based Access Control</CardTitle>
              <CardDescription>
                Access restricted to business hours with after-hours approval system
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 5 */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <CardTitle>Role-Based Permissions</CardTitle>
              <CardDescription>
                Five distinct roles with hierarchical access and approval workflows
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 6 */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <CardTitle>Approval Workflow</CardTitle>
              <CardDescription>
                Three-level approval process: Manager → Department Head → HR Admin
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* How It Works Section */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">How It Works</h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Login</h3>
              <p className="text-slate-600 text-sm">
                Authenticate with email, password, and MFA code (for Manager+ roles)
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Create Nomination</h3>
              <p className="text-slate-600 text-sm">
                Managers nominate employees for promotions or bonuses with justification
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Approval Workflow</h3>
              <p className="text-slate-600 text-sm">
                Three-level approval: Manager → Department Head → HR Admin
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Track Status</h3>
              <p className="text-slate-600 text-sm">
                Employees and managers can track nomination status in real-time
              </p>
            </div>
          </div>
        </div>

        {/* Security Features */}
        <div className="mt-20 bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Security Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-slate-900">Strong Password Policy</p>
                <p className="text-sm text-slate-600">Minimum 8 characters with uppercase, digit, and special character</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-slate-900">Account Lockout Protection</p>
                <p className="text-sm text-slate-600">15-minute lockout after 5 failed login attempts</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-slate-900">Data Classification</p>
                <p className="text-sm text-slate-600">Automatic sensitivity labeling: Public, Internal, Confidential</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-slate-900">Complete Audit Trail</p>
                <p className="text-sm text-slate-600">All actions logged with IP addresses and timestamps</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 text-center text-slate-600">
          <p className="font-semibold">Addis Ababa Science and Technology University</p>
          <p>Department of Software Engineering</p>
          <p className="text-slate-500 mt-2">Computer System Security - Project Two</p>
        </div>
      </div>
    </div>
  );
}

