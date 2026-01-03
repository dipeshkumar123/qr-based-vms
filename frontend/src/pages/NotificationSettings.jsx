import { useState } from 'react';
import { Mail, MessageSquare, Bell, Save, CheckCircle } from 'lucide-react';

export default function NotificationSettings() {
  const [saveStatus, setSaveStatus] = useState('');
  const [settings, setSettings] = useState({
    emailEnabled: true,
    smsEnabled: false,
    notifyVisitorArrival: true,
    notifyFailedVerification: true,
    notifyRepeatedPatterns: true,
    notifySuspiciousActivity: true,
    adminEmail: 'admin@example.com',
    adminPhone: '+1234567890',
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpUser: '',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhone: '',
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaveStatus('saving');
    
    // Simulate save operation
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 3000);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-8 w-8 text-purple-600" />
            Notification Settings
          </h1>
          <p className="text-gray-600 mt-2">
            Configure email and SMS alerts for visitor management events
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Alert Types */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-600" />
              Alert Types
            </h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="notifyVisitorArrival"
                  checked={settings.notifyVisitorArrival}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Visitor Arrival</span>
                  <p className="text-sm text-gray-600">
                    Get notified when a new visitor registers
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="notifyFailedVerification"
                  checked={settings.notifyFailedVerification}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Failed Face Verification</span>
                  <p className="text-sm text-gray-600">
                    Alert when biometric verification fails
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="notifyRepeatedPatterns"
                  checked={settings.notifyRepeatedPatterns}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Repeated Visit Patterns</span>
                  <p className="text-sm text-gray-600">
                    Notify about visitors with high visit frequency
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="notifySuspiciousActivity"
                  checked={settings.notifySuspiciousActivity}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Suspicious Activity</span>
                  <p className="text-sm text-gray-600">
                    Alert when ML detects anomalous behavior
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Email Configuration */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="h-5 w-5 text-purple-600" />
              Email Configuration
            </h2>
            
            <label className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                name="emailEnabled"
                checked={settings.emailEnabled}
                onChange={handleInputChange}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="font-medium text-gray-900">Enable Email Notifications</span>
            </label>

            {settings.emailEnabled && (
              <div className="space-y-4 pl-7">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Email
                  </label>
                  <input
                    type="email"
                    name="adminEmail"
                    value={settings.adminEmail}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="admin@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    name="smtpHost"
                    value={settings.smtpHost}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="smtp.gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Port
                  </label>
                  <input
                    type="text"
                    name="smtpPort"
                    value={settings.smtpPort}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="587"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Username
                  </label>
                  <input
                    type="text"
                    name="smtpUser"
                    value={settings.smtpUser}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="your-email@gmail.com"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SMS Configuration */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              SMS Configuration (Twilio)
            </h2>
            
            <label className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                name="smsEnabled"
                checked={settings.smsEnabled}
                onChange={handleInputChange}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="font-medium text-gray-900">Enable SMS Notifications</span>
            </label>

            {settings.smsEnabled && (
              <div className="space-y-4 pl-7">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Phone
                  </label>
                  <input
                    type="tel"
                    name="adminPhone"
                    value={settings.adminPhone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="+1234567890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Twilio Account SID
                  </label>
                  <input
                    type="text"
                    name="twilioAccountSid"
                    value={settings.twilioAccountSid}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Twilio Auth Token
                  </label>
                  <input
                    type="password"
                    name="twilioAuthToken"
                    value={settings.twilioAuthToken}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="********************************"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Twilio Phone Number
                  </label>
                  <input
                    type="tel"
                    name="twilioPhone"
                    value={settings.twilioPhone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="+1234567890"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-4">
            {saveStatus === 'saved' && (
              <span className="text-green-600 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Settings saved successfully!
              </span>
            )}
            <button
              type="submit"
              disabled={saveStatus === 'saving'}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-5 w-5" />
              {saveStatus === 'saving' ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

        {/* Information Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Configuration Note</h3>
          <p className="text-sm text-blue-800">
            These settings are stored in the backend <code className="bg-blue-100 px-1 rounded">.env</code> file.
            To apply changes, update the environment variables and restart the backend server.
          </p>
          <ul className="mt-2 text-sm text-blue-800 list-disc list-inside space-y-1">
            <li>For Gmail SMTP, use an <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="underline">App Password</a></li>
            <li>Get Twilio credentials from your <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer" className="underline">Twilio Console</a></li>
            <li>SMS alerts require <code className="bg-blue-100 px-1 rounded">ENABLE_SMS_ALERTS=true</code> in .env</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
