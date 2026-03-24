import { Activity, Plus, AlertCircle, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useState, useEffect } from 'react';

interface SymptomsProps {
  onNavigate: (page: string) => void;
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

interface Profile {
  id: string;
  name: string;
  relation: string;
}

export function Symptoms({ onNavigate }: SymptomsProps) {
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');

  const [symptomType, setSymptomType] = useState('');
  const [symptomDescription, setSymptomDescription] = useState('');
  const [severity, setSeverity] = useState([5]);
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [activeTab, setActiveTab] = useState('log');

  // Load initial data
  useEffect(() => {
    // Fetch profiles first
    fetch('http://localhost:8000/family')
      .then(res => res.json())
      .then(data => {
        setProfiles(data);
        if (data.length > 0) setSelectedProfile(data[0].id);
      })
      .catch(err => console.error(err));

    // Fetch symptoms
    fetch('http://localhost:8000/symptoms')
      .then(res => res.json())
      .then(data => setSymptoms(data))
      .catch(err => console.error(err));
  }, []);

  const saveSymptoms = (newSymptoms: Symptom[]) => {
    setSymptoms(newSymptoms);
    fetch('http://localhost:8000/symptoms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSymptoms),
    }).catch(err => console.error(err));
  };

  const handleLogSymptom = () => {
    if (!symptomType) {
      alert("Please select a symptom type.");
      return;
    }
    if (!selectedProfile) {
      alert("Please select a profile.");
      return;
    }

    const newSymptom: Symptom = {
      id: Math.random().toString(36).substr(2, 9),
      profileId: selectedProfile,
      type: symptomType,
      description: symptomDescription,
      severity: severity[0],
      duration: duration,
      notes: notes,
      date: new Date().toISOString(),
    };

    saveSymptoms([newSymptom, ...symptoms]);

    // Reset form
    setSymptomType('');
    setSymptomDescription('');
    setSeverity([5]);
    setNotes('');
    setDuration('');
    setActiveTab('history');
  };

  const getSeverityColor = (sev: number) => {
    if (sev <= 3) return 'green';
    if (sev <= 6) return 'orange';
    return 'red';
  };

  const filteredSymptoms = symptoms.filter(s => s.profileId === selectedProfile);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white p-4 border-b border-gray-200">
          <h1 className="mb-4">Symptoms</h1>

          {/* Profile Selector */}
          <Select value={selectedProfile} onValueChange={setSelectedProfile}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select profile" />
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
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="log" className="flex-1">Log Symptom</TabsTrigger>
              <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
            </TabsList>

            <TabsContent value="log" className="space-y-4 mt-4">
              {/* Log New Symptom */}
              <Card className="p-4">
                <div className="mb-4">Log New Symptom</div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">Symptom Type</label>
                    <Select value={symptomType} onValueChange={setSymptomType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select symptom type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Headache">Headache</SelectItem>
                        <SelectItem value="Nausea">Nausea</SelectItem>
                        <SelectItem value="Fever">Fever</SelectItem>
                        <SelectItem value="Cough">Cough</SelectItem>
                        <SelectItem value="Fatigue">Fatigue</SelectItem>
                        <SelectItem value="Pain">Pain</SelectItem>
                        <SelectItem value="Dizziness">Dizziness</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">Description</label>
                    <Input
                      placeholder="Brief description"
                      value={symptomDescription}
                      onChange={(e) => setSymptomDescription(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 mb-2 block">
                      Severity: {severity[0]}/10
                    </label>
                    <Slider
                      value={severity}
                      onValueChange={setSeverity}
                      min={1}
                      max={10}
                      step={1}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Mild</span>
                      <span>Moderate</span>
                      <span>Severe</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">Duration</label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue placeholder="How long?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Less than 1 hour">Less than 1 hour</SelectItem>
                        <SelectItem value="Few hours">Few hours</SelectItem>
                        <SelectItem value="About a day">About a day</SelectItem>
                        <SelectItem value="Few days">Few days</SelectItem>
                        <SelectItem value="About a week">About a week</SelectItem>
                        <SelectItem value="Longer than a week">Longer than a week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">Additional Notes</label>
                    <Textarea
                      placeholder="Any additional details..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button className="w-full" onClick={handleLogSymptom}>
                    <Plus className="w-4 h-4 mr-2" />
                    Log Symptom
                  </Button>
                </div>
              </Card>

              {/* Quick Tips */}
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="mb-2">💡 Tracking Tips</div>
                <div className="text-gray-600 text-sm space-y-1">
                  <div>• Be specific about location and type</div>
                  <div>• Note any triggers or patterns</div>
                  <div>• Track before and after meals</div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-4">
              {/* Symptom Trends */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <div>Summary for {profiles.find(p => p.id === selectedProfile)?.name}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-gray-500 text-sm">Total Logged</div>
                    <div>{filteredSymptoms.length} symptoms</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-gray-500 text-sm">Avg Severity</div>
                    <div>
                      {filteredSymptoms.length > 0
                        ? (filteredSymptoms.reduce((acc, s) => acc + s.severity, 0) / filteredSymptoms.length).toFixed(1)
                        : '0'}
                      /10
                    </div>
                  </div>
                </div>
              </Card>

              {/* Symptom History */}
              <div>
                <div className="mb-3">Recent Symptoms</div>
                <div className="space-y-3">
                  {filteredSymptoms.length === 0 && (
                    <div className="text-center text-gray-500 py-8">No symptoms logged for this profile.</div>
                  )}
                  {filteredSymptoms.map(symptom => {
                    const color = getSeverityColor(symptom.severity);
                    return (
                      <Card key={symptom.id} className={`p-4 border-l-4 border-${color}-500`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="mb-1 font-medium">{symptom.type}</div>
                            <div className="text-gray-600 text-sm">{symptom.description}</div>
                          </div>
                          <Badge className={`bg-${color}-100 text-${color}-800`}>{symptom.severity}/10</Badge>
                        </div>
                        <div className="text-gray-400 text-xs mb-2">Duration: {symptom.duration}</div>
                        <div className="text-gray-400 text-xs">{new Date(symptom.date).toLocaleDateString()} {new Date(symptom.date).toLocaleTimeString()}</div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
