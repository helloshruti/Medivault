import { Heart, Bell, Pill, Activity, FileText, Calendar, MessageCircle, Send, Loader2, Wind, Droplets, Apple, Venus } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { API_URL } from "../config";

interface DashboardProps {
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

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeOfDay: string;
  active: boolean;
  takenToday: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const displayName = user ? user.name.split(' ').filter((part) => !/^\d+$/.test(part)).join(' ') : '';
  const { profiles, selectedProfileId, setSelectedProfileId, selectedProfile } = useProfile();
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isVitalsOpen, setIsVitalsOpen] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Hi! I\'m MediVault AI. Ask me anything about medications, symptoms, or general health.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const YESNO_IDS = ['highChol','smoker','physActivity','fruits','veggies','hvyAlcohol'];

  const DEFAULT_VITALS = [
    { id: 'bp',           name: 'Blood Pressure',    value: '120/80', icon: Heart,    color: 'red'    },
    { id: 'highChol',     name: 'High Cholesterol',  value: 'No',     icon: Droplets, color: 'yellow' },
    { id: 'bmi',          name: 'BMI',               value: '22',     icon: Activity, color: 'orange' },
    { id: 'smoker',       name: 'Smoker',            value: 'No',     icon: Wind,     color: 'gray'   },
    { id: 'physActivity', name: 'Physically Active', value: 'Yes',    icon: Activity, color: 'green'  },
    { id: 'fruits',       name: 'Fruits Daily',      value: 'Yes',    icon: Apple,    color: 'lime'   },
    { id: 'veggies',      name: 'Veggies Daily',     value: 'Yes',    icon: Apple,    color: 'green'  },
    { id: 'hvyAlcohol',   name: 'Heavy Alcohol Use', value: 'No',     icon: Activity, color: 'orange' },
  ];

  const [vitals, setVitals] = useState(DEFAULT_VITALS);
  const [vitalsForm, setVitalsForm] = useState<Record<string, string>>({});

  // Load saved vitals for the selected profile
  useEffect(() => {
    if (!selectedProfileId) return;
    const saved = localStorage.getItem(`mv_vitals_${user?.email}_${selectedProfileId}`);
    if (saved) {
      try {
        const savedValues: Record<string, string> = JSON.parse(saved);
        setVitals(DEFAULT_VITALS.map(v => ({ ...v, value: savedValues[v.id] ?? v.value })));
      } catch { setVitals(DEFAULT_VITALS); }
    } else {
      setVitals(DEFAULT_VITALS);
    }
  }, [selectedProfileId]);

  const userEmail = encodeURIComponent(user?.email || '');

  // Load data — re-fetch meds when profile changes
  useEffect(() => {
    if (!userEmail) return;
    fetch(`${API_URL}/symptoms?user=${userEmail}`)
      .then(res => res.json())
      .then(data => setSymptoms(data))
      .catch(err => console.error(err));
  }, [userEmail]);

  useEffect(() => {
    if (!selectedProfileId || !userEmail) return;
    fetch(`${API_URL}/medications?profile=${selectedProfileId}&user=${userEmail}`)
      .then(res => res.json())
      .then(data => setMedications(data))
      .catch(err => console.error(err));
  }, [selectedProfileId, userEmail]);

  const profileSymptoms = symptoms.filter(s => s.profileId === selectedProfileId).slice(0, 3);
  const nextMedication = medications.find(m => m.active && !m.takenToday);

  const dashboardVitals = vitals.slice(0, 3);

  const overallHealthScore = (() => {
    const get = (id: string) => vitals.find(v => v.id === id)?.value ?? '';
    let score = 10;

    const bpSys = parseInt(get('bp').split('/')[0]);
    if (!isNaN(bpSys)) {
      if (bpSys >= 140)      score -= 2;
      else if (bpSys >= 130) score -= 1;
      else if (bpSys >= 120) score -= 0.5;
    }
    if (get('highChol') === 'Yes') score -= 1;
    const bmi = parseFloat(get('bmi'));
    if (!isNaN(bmi)) {
      if (bmi < 18.5 || (bmi >= 25 && bmi < 30))   score -= 0.5;
      else if (bmi >= 30 && bmi < 35)               score -= 1;
      else if (bmi >= 35)                           score -= 1.5;
    }
    if (get('smoker') === 'Yes')      score -= 1;
    if (get('physActivity') === 'No') score -= 0.5;
    if (get('fruits') === 'No')         score -= 0.3;
    if (get('veggies') === 'No')        score -= 0.3;
    if (get('hvyAlcohol') === 'Yes')    score -= 1;
    return Math.min(10, Math.max(1, Math.round(score)));
  })();

  const healthScoreConfig = overallHealthScore >= 8
    ? { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50', bar: 'bg-green-500', ring: 'ring-green-400' }
    : overallHealthScore >= 6
    ? { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50', bar: 'bg-blue-500', ring: 'ring-blue-400' }
    : overallHealthScore >= 4
    ? { label: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-50', bar: 'bg-yellow-500', ring: 'ring-yellow-400' }
    : { label: 'Poor', color: 'text-red-600', bg: 'bg-red-50', bar: 'bg-red-500', ring: 'ring-red-400' };

  const getSeverityColor = (sev: number) => {
    if (sev <= 3) return 'green';
    if (sev <= 6) return 'yellow';
    return 'red';
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, 50);
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Could not reach the AI. Make sure Ollama is running.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, 50);
    }
  };

  const handleUpdateVitals = () => {
    const updated = vitals.map(v => vitalsForm[v.id] !== undefined ? { ...v, value: vitalsForm[v.id] } : v);
    setVitals(updated);
    if (selectedProfileId) {
      const toSave = Object.fromEntries(updated.map(v => [v.id, v.value]));
      localStorage.setItem(`mv_vitals_${user?.email}_${selectedProfileId}`, JSON.stringify(toSave));
    }

    // Append to dataset
    const get = (id: string) => updated.find(v => v.id === id)?.value ?? '';
    fetch(`${API_URL}/vitals/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bp:           get('bp'),
        highChol:     get('highChol'),
        bmi:          get('bmi'),
        smoker:       get('smoker'),
        physActivity: get('physActivity'),
        fruits:       get('fruits'),
        veggies:      get('veggies'),
        hvyAlcohol:   get('hvyAlcohol'),
        age:          selectedProfile?.age ?? null,
        gender:       selectedProfile?.gender ?? null,
      }),
    }).catch(err => console.error('Failed to record vitals:', err));

    setVitalsForm({});
    setIsVitalsOpen(false);
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
          <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
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
          {/* Greeting */}
          <div className="text-xl font-semibold">Hello {displayName}</div>

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
              <Dialog open={isVitalsOpen} onOpenChange={setIsVitalsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">View All</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Vitals</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="all" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="all">All Vitals</TabsTrigger>
                      <TabsTrigger value="update">Update Vitals</TabsTrigger>
                    </TabsList>
                    <TabsContent value="all" className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
                      <div className="space-y-2">
                        {vitals.map((vital) => (
                          <div key={vital.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 bg-${vital.color}-100 rounded-full flex items-center justify-center flex-shrink-0`}>
                                <vital.icon className={`w-4 h-4 text-${vital.color}-600`} />
                              </div>
                              <div className="text-sm">{vital.name}</div>
                            </div>
                            <span className="text-sm font-medium text-gray-700">{vital.value}</span>
                          </div>
                        ))}
                        {selectedProfile && (
                          <>
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Activity className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="text-sm">Age</div>
                              </div>
                              <span className="text-sm font-medium text-gray-700">{selectedProfile.age ?? '—'} yrs</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Venus className="w-4 h-4 text-pink-600" />
                                </div>
                                <div className="text-sm">Gender</div>
                              </div>
                              <span className="text-sm font-medium text-gray-700">{selectedProfile.gender ?? '—'}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="update" className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
                      <div className="space-y-4">
                        {vitals.map((vital) => {
                          const current = vitalsForm[vital.id] ?? vital.value;
                          const isYesNo = YESNO_IDS.includes(vital.id);
                          return (
                            <div key={vital.id} className="space-y-1">
                              <Label>{vital.name}</Label>
                              {vital.id === 'bp' ? (
                                <Input
                                  placeholder="e.g. 120/80"
                                  value={current}
                                  onChange={e => setVitalsForm(prev => ({ ...prev, [vital.id]: e.target.value }))}
                                />
                              ) : isYesNo ? (
                                <Select value={current} onValueChange={(v: string) => setVitalsForm(prev => ({ ...prev, [vital.id]: v }))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="No">No</SelectItem>
                                    <SelectItem value="Yes">Yes</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  type="number"
                                  value={current}
                                  min={0}
                                  max={vital.id === 'bmi' ? 60 : 100}
                                  step={vital.id === 'bmi' ? 0.1 : 1}
                                  onChange={e => setVitalsForm(prev => ({ ...prev, [vital.id]: e.target.value }))}
                                />
                              )}
                            </div>
                          );
                        })}
                        {selectedProfile && (
                          <div className="p-3 bg-blue-50 rounded-lg space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Age</span>
                              <span className="font-medium">{selectedProfile.age ?? '—'} yrs <span className="text-xs text-gray-400">(from profile)</span></span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Gender</span>
                              <span className="font-medium">{selectedProfile.gender ?? '—'} <span className="text-xs text-gray-400">(from profile)</span></span>
                            </div>
                          </div>
                        )}
                        <Button className="w-full" onClick={handleUpdateVitals}>Save Vitals</Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-3">
              {dashboardVitals.map((vital, index) => (
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

          {/* AI Chatbot */}
          <Card className="flex flex-col overflow-hidden" style={{ height: '420px' }}>
            {/* Header */}
            <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-2 flex-shrink-0">
              <MessageCircle className="w-5 h-5" />
              <div>
                <div className="text-sm font-semibold">MediVault AI</div>
                <div className="text-xs text-blue-200">Ask me anything health-related</div>
              </div>
            </div>

            {/* Messages */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-100 flex gap-2 flex-shrink-0 bg-white">
              <input
                className="flex-1 text-sm border border-gray-200 rounded-full px-3 py-2 outline-none focus:border-blue-400"
                placeholder="Ask a health question..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
              />
              <button
                onClick={sendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </Card>

          {/* Recent Symptoms */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>Recent Symptoms ({profiles.find(p => p.id === selectedProfileId)?.name})</div>
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

          {/* Overall Health Score */}
          <Card className="p-4">
            <div className="mb-3">Overall Health Score</div>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ${healthScoreConfig.ring} ${healthScoreConfig.bg}`}>
                <span className={`text-2xl font-bold ${healthScoreConfig.color}`}>{overallHealthScore}</span>
              </div>
              <div className="flex-1">
                <div className={`text-sm font-semibold mb-1 ${healthScoreConfig.color}`}>{healthScoreConfig.label}</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${healthScoreConfig.bar}`}
                    style={{ width: `${overallHealthScore * 10}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>1 — Poor</span>
                  <span>10 — Best</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Based on your vitals. Update them to keep this accurate.</p>
          </Card>
        </div>
      </div>

    </div>
  );
}