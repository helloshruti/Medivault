<<<<<<< HEAD
import { Heart, Bell, ChevronRight, Pill, Activity, FileText, Calendar, Droplet, Brain, Plus } from 'lucide-react';
=======
import { Heart, Bell, ChevronRight, Pill, Activity, FileText, Calendar } from 'lucide-react';
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
<<<<<<< HEAD
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: string) => void;
  familyRefreshToken: number;
=======
import { useState, useEffect } from 'react';

interface DashboardProps {
  onNavigate: (page: string) => void;
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab
}

interface Profile {
  id: string;
  name: string;
  relation: string;
<<<<<<< HEAD
  active: boolean;
=======
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab
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

<<<<<<< HEAD
export function Dashboard({ onNavigate, familyRefreshToken }: DashboardProps) {
  const { user, logout } = useAuth();
=======
export function Dashboard({ onNavigate }: DashboardProps) {
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
<<<<<<< HEAD
  const [showAllVitals, setShowAllVitals] = useState(false);
  const [vitalsData, setVitalsData] = useState({
    bloodPressure: '120/80 mmHg',
    heartRate: '72 bpm',
    temperature: '98.6°F',
    cholesterol: '180 mg/dL',
    physicalActivity: '45 mins/day',
    mentalHealth: '4/5'
  });
=======
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab

  // Load data
  useEffect(() => {
    // Profiles
    fetch('http://localhost:8000/family')
      .then(res => res.json())
<<<<<<< HEAD
      .then((data: Profile[]) => {
        setProfiles(data);
        const activeProfile = data.find((p) => p.active);
        if (activeProfile) {
          setSelectedProfile(activeProfile.id);
        } else if (data.length > 0) {
          setSelectedProfile(data[0].id);
        }
=======
      .then(data => {
        setProfiles(data);
        if (data.length > 0) setSelectedProfile(data[0].id);
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab
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
<<<<<<< HEAD
  }, [familyRefreshToken]);
=======
  }, []);
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab

  const currentProfile = profiles.find(p => p.id === selectedProfile);
  const profileSymptoms = symptoms.filter(s => s.profileId === selectedProfile).slice(0, 3);
  const nextMedication = medications.find(m => m.active && !m.takenToday);

  // Mock vitals for demo (since we don't have a backend for this yet)
  const getVitals = () => {
    return [
<<<<<<< HEAD
      { id: 'bloodPressure', name: 'Blood Pressure', value: vitalsData.bloodPressure, icon: Heart, color: 'red' },
      { id: 'heartRate', name: 'Heart Rate', value: vitalsData.heartRate, icon: Activity, color: 'blue' },
      { id: 'temperature', name: 'Temperature', value: vitalsData.temperature, icon: Activity, color: 'orange' },
      { id: 'cholesterol', name: 'Cholesterol', value: vitalsData.cholesterol, icon: Droplet, color: 'purple' },
      { id: 'physicalActivity', name: 'Physical Activity', value: vitalsData.physicalActivity, icon: Activity, color: 'green' },
      { id: 'mentalHealth', name: 'Mental Health', value: vitalsData.mentalHealth, icon: Brain, color: 'cyan' },
    ];
  };

  const vitals = showAllVitals ? getVitals() : getVitals().slice(0, 3);
=======
      { name: 'Blood Pressure', value: '120/80 mmHg', icon: Heart, color: 'red' },
      { name: 'Heart Rate', value: '72 bpm', icon: Activity, color: 'blue' },
      { name: 'Temperature', value: '98.6°F', icon: Activity, color: 'orange' },
    ];
  };

  const vitals = getVitals();
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab

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
<<<<<<< HEAD
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={logout} title="Logout">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
=======
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab
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

<<<<<<< HEAD
        <div className="px-4 pt-4 pb-0">
          <h1 className="text-xl font-semibold">Welcome back, {user?.name || 'User'}!</h1>
          <p className="text-gray-500 text-sm">Here's your health summary for today.</p>
        </div>

=======
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab
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
<<<<<<< HEAD
              <div className="font-medium">Latest Vitals</div>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Update Vitals
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Update Vitals</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      {getVitals().map((vital) => (
                        <div key={vital.id} className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor={vital.id} className="text-right text-sm">
                            {vital.name}
                          </Label>
                          <Input
                            id={vital.id}
                            value={vitalsData[vital.id as keyof typeof vitalsData]}
                            onChange={(e) => setVitalsData({ ...vitalsData, [vital.id]: e.target.value })}
                            className="col-span-3"
                          />
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="sm" onClick={() => setShowAllVitals(!showAllVitals)}>
                  {showAllVitals ? 'View Less' : 'View All'}
                </Button>
              </div>
=======
              <div>Latest Vitals</div>
              <Button variant="ghost" size="sm">View All</Button>
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab
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
<<<<<<< HEAD
}
=======
}
>>>>>>> e0fa3bc5ba42b41cbdeb8f8ef8c28e76d397f1ab
