import { Heart, Bell, Pill, Activity, FileText, Calendar, Brain, User, MessageCircle, Send, Loader2 } from 'lucide-react';
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
  const { profiles, selectedProfileId, setSelectedProfileId } = useProfile();
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

  const [vitals, setVitals] = useState([
    { id: 'bp', name: 'Blood Pressure', value: '120/80 mmHg', icon: Heart, color: 'red' },
    { id: 'hr', name: 'Heart Rate', value: '72 bpm', icon: Activity, color: 'blue' },
    { id: 'temp', name: 'Temperature', value: '98.6°F', icon: Activity, color: 'orange' },
    { id: 'gh', name: 'General Health', value: '4/5', icon: Activity, color: 'green' },
    { id: 'mh', name: 'Mental Health', value: '4/5', icon: Brain, color: 'purple' },
    { id: 'age', name: 'Age', value: '45 yrs', icon: User, color: 'indigo' },
  ]);

  // Load data — re-fetch meds when profile changes
  useEffect(() => {
    fetch('http://localhost:8000/symptoms')
      .then(res => res.json())
      .then(data => setSymptoms(data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (!selectedProfileId) return;
    fetch(`http://localhost:8000/medications?profile=${selectedProfileId}`)
      .then(res => res.json())
      .then(data => setMedications(data))
      .catch(err => console.error(err));
  }, [selectedProfileId]);

  const profileSymptoms = symptoms.filter(s => s.profileId === selectedProfileId).slice(0, 3);
  const nextMedication = medications.find(m => m.active && !m.takenToday);

  const dashboardVitals = vitals.slice(0, 3);

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
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const res = await fetch('http://localhost:8000/chat', {
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
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const handleUpdateVitals = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newVitals = [...vitals];

    const bp = formData.get('bp');
    if (bp) newVitals[0].value = bp as string + ' mmHg';

    const hr = formData.get('hr');
    if (hr) newVitals[1].value = hr + ' bpm';

    const temp = formData.get('temp');
    if (temp) newVitals[2].value = temp + '°F';

    const gh = formData.get('gh');
    if (gh) newVitals[3].value = gh + '/5';

    const mh = formData.get('mh');
    if (mh) newVitals[4].value = mh + '/5';

    setVitals(newVitals);
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
                    <TabsContent value="all" className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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
                    </TabsContent>
                    <TabsContent value="update" className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
                      <form onSubmit={handleUpdateVitals} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="bp">Blood Pressure (e.g., 120/80)</Label>
                          <Input id="bp" name="bp" placeholder={vitals[0].value.replace(' mmHg', '')} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="hr">Heart Rate (bpm)</Label>
                          <Input id="hr" name="hr" placeholder={vitals[1].value.replace(' bpm', '')} type="number" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="temp">Temperature (°F)</Label>
                          <Input id="temp" name="temp" placeholder={vitals[2].value.replace('°F', '')} type="number" step="0.1" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gh">General Health (1-5)</Label>
                          <Input id="gh" name="gh" placeholder={vitals[3].value.replace('/5', '')} type="number" min="1" max="5" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mh">Mental Health (1-5)</Label>
                          <Input id="mh" name="mh" placeholder={vitals[4].value.replace('/5', '')} type="number" min="1" max="5" />
                        </div>
                        <Button type="submit" className="w-full">Submit</Button>
                      </form>
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
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
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
        </div>
      </div>

    </div>
  );
}