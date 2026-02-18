import { Heart, Bell, ChevronRight, Pill, Activity, FileText, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useState, useEffect } from 'react';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

interface Profile {
  id: string;
  name: string;
  relation: string;
}

interface Symptom {
  id: string;
  profileId: string;
  type: string;
  description: string;
  severity: number;
  duration: string;
  notes: string;
  date: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeOfDay: string;
  active: boolean;
  takenToday: boolean;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);

  // Load data
  useEffect(() => {
    // Profiles
    fetch('http://localhost:8000/family')
      .then(res => res.json())
      .then(data => {
        setProfiles(data);
        if (data.length > 0) setSelectedProfile(data[0].id);
      })
      .catch(err => console.error(err));

    // Symptoms
    fetch('http://localhost:8000/symptoms')
      .then(res => res.json())
      .then(data => setSymptoms(data))
      .catch(err => console.error(err));

    // Medications (Note: Currently shared across profiles)
    fetch('http://localhost:8000/medications')
      .then(res => res.json())
      .then(data => setMedications(data))
      .catch(err => console.error(err));
  }, []);

  const currentProfile = profiles.find(p => p.id === selectedProfile);
  const profileSymptoms = symptoms.filter(s => s.profileId === selectedProfile).slice(0, 3);
  const nextMedication = medications.find(m => m.active && !m.takenToday);

  // Mock vitals for demo (since we don't have a backend for this yet)
  const getVitals = () => {
    return [
      { name: 'Blood Pressure', value: '120/80 mmHg', icon: Heart, color: 'red' },
      { name: 'Heart Rate', value: '72 bpm', icon: Activity, color: 'blue' },
      { name: 'Temperature', value: '98.6°F', icon: Activity, color: 'orange' },
    ];
  };

  const vitals = getVitals();

  const getSeverityColor = (sev: number) => {
    if (sev <= 3) return 'green';
    if (sev <= 6) return 'yellow';
    return 'red';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div className="text-blue-600">MediVault AI</div>
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
          </div>

          {/* Profile Selector */}
          <Select value={selectedProfile} onValueChange={setSelectedProfile}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={profiles.length > 0 ? "Select profile" : "Loading profiles..."} />
            </SelectTrigger>
            <SelectContent>
              {profiles.map(profile => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name} ({profile.relation})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="p-4 space-y-4">
          {/* Today's Notifications */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div>Today's Notifications</div>
              <Badge className="bg-blue-600">{medications.filter(m => m.takenToday).length}/{medications.length}</Badge>
            </div>
            <div className="text-gray-600">
              {medications.filter(m => m.takenToday).length} medication(s) taken, {medications.filter(m => !m.takenToday).length} pending
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-3">
            <Card
              className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onNavigate('medications')}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Pill className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-sm">Medicines</div>
            </Card>
            <Card
              className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onNavigate('symptoms')}
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-sm">Symptoms</div>
            </Card>
            <Card
              className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onNavigate('documents')}
            >
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-sm">Documents</div>
            </Card>
          </div>

          {/* Latest Vitals */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>Latest Vitals</div>
              <Button variant="ghost" size="sm">View All</Button>
            </div>
            <div className="space-y-3">
              {vitals.map((vital, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 bg-${vital.color}-100 rounded-full flex items-center justify-center`}>
                      <vital.icon className={`w-5 h-5 text-${vital.color}-600`} />
                    </div>
                    <div>
                      <div className="text-sm">{vital.name}</div>
                      <div className="text-gray-500">{vital.value}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Next Medication */}
          <Card className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5" />
              <div>Next Medication</div>
            </div>
            {nextMedication ? (
              <>
                <div className="mb-1">{nextMedication.name}</div>
                <div className="text-blue-100">{nextMedication.timeOfDay} - {nextMedication.dosage}</div>
              </>
            ) : (
              <div className="text-blue-100">No pending medications for today</div>
            )}
          </Card>

          {/* Recent Symptoms */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>Recent Symptoms ({currentProfile?.name})</div>
              <Button
                variant="link"
                size="sm"
                onClick={() => onNavigate('symptoms')}
              >
                See All
              </Button>
            </div>
            <div className="space-y-3">
              {profileSymptoms.length === 0 && <div className="text-gray-500 text-sm">No recent symptoms logged.</div>}
              {profileSymptoms.map((symptom, index) => {
                const severityColor = getSeverityColor(symptom.severity);
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border border-${severityColor}-200 bg-${severityColor}-50`}
                  >
                    <div className="flex-1">
                      <div>{symptom.type}</div>
                      <div className="text-gray-500 text-xs">{new Date(symptom.date).toLocaleDateString()}</div>
                    </div>
                    <Badge className={`bg-${severityColor}-100 text-${severityColor}-800`}>
                      {symptom.severity}/10
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Family Members */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>Family Members</div>
              <Button
                variant="link"
                size="sm"
                onClick={() => onNavigate('family')}
              >
                Manage
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {profiles.slice(0, 5).map(p => (
                <div key={p.id} className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center" title={p.name}>
                  <span className="text-blue-600">{p.name.charAt(0)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}