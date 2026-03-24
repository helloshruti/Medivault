import { Pill, Plus, Clock, Edit, Trash2, CheckCircle2, Circle, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useState, useEffect } from 'react';

interface MedicationsProps {
  onNavigate: (page: string) => void;
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

export function Medications({ onNavigate }: MedicationsProps) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load meds
  useEffect(() => {
    fetch('http://localhost:8000/medications')
      .then(res => res.json())
      .then(data => setMedications(data))
      .catch(err => console.error(err));
  }, []);

  const saveMeds = (newMeds: Medication[]) => {
    setMedications(newMeds);
    fetch('http://localhost:8000/medications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMeds),
    }).catch(err => console.error(err));
  };

  const handleAddMedication = () => {
    if (!newMedName || !newMedDosage) return;

    if (editingId) {
      const updatedMeds = medications.map(med =>
        med.id === editingId ? { ...med, name: newMedName, dosage: newMedDosage, frequency, timeOfDay } : med
      );
      saveMeds(updatedMeds);
      setEditingId(null);
    } else {
      const newMed: Medication = {
        id: Math.random().toString(36).substr(2, 9),
        name: newMedName,
        dosage: newMedDosage,
        frequency: frequency || 'once',
        timeOfDay: timeOfDay || 'morning',
        active: true,
        takenToday: false
      };
      saveMeds([...medications, newMed]);
    }

    setNewMedName('');
    setNewMedDosage('');
    setFrequency('');
    setTimeOfDay('');
  };

  const handleEdit = (med: Medication) => {
    setEditingId(med.id);
    setNewMedName(med.name);
    setNewMedDosage(med.dosage);
    setFrequency(med.frequency);
    setTimeOfDay(med.timeOfDay);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewMedName('');
    setNewMedDosage('');
    setFrequency('');
    setTimeOfDay('');
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this medication?')) {
      saveMeds(medications.filter(m => m.id !== id));
    }
  };

  const handleToggleTaken = (id: string) => {
    saveMeds(medications.map(m =>
      m.id === id ? { ...m, takenToday: !m.takenToday } : m
    ));
  };

  const getTimeDisplay = (time: string) => {
    switch (time) {
      case 'morning': return '08:00 AM';
      case 'noon': return '12:00 PM';
      case 'afternoon': return '03:00 PM';
      case 'evening': return '06:00 PM';
      case 'night': return '09:00 PM';
      default: return 'Anytime';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white p-4 border-b border-gray-200">
          <h1 className="mb-4">Medications</h1>

          {/* Profile Selector */}
          <Select defaultValue="self">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select profile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="self">Tanishka (Self)</SelectItem>
              <SelectItem value="sister">Shruti (Sister)</SelectItem>
              <SelectItem value="mother">Trisha (Mother)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="p-4 space-y-4">
          {/* Tabs */}
          <Tabs defaultValue="active">
            <TabsList className="w-full">
              <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
              <TabsTrigger value="archive" className="flex-1">Archive</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4 mt-4">
              {/* Add New Medication */}
              <Card className="p-4">
                <div className="mb-4">{editingId ? 'Edit Medication' : 'Add New Medication'}</div>
                <div className="space-y-3">
                  <Input
                    placeholder="Medication name"
                    value={newMedName}
                    onChange={(e) => setNewMedName(e.target.value)}
                  />
                  <Input
                    placeholder="Dosage (e.g., 500mg)"
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                  />
                  <Select value={frequency} onValueChange={(value: string) => setFrequency(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Once daily</SelectItem>
                      <SelectItem value="twice">Twice daily</SelectItem>
                      <SelectItem value="three">Three times daily</SelectItem>
                      <SelectItem value="asneeded">As needed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={timeOfDay} onValueChange={(value: string) => setTimeOfDay(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Time of day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning (8:00 AM)</SelectItem>
                      <SelectItem value="noon">Noon (12:00 PM)</SelectItem>
                      <SelectItem value="afternoon">Afternoon (3:00 PM)</SelectItem>
                      <SelectItem value="evening">Evening (6:00 PM)</SelectItem>
                      <SelectItem value="night">Night (9:00 PM)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    {editingId && (
                      <Button variant="outline" className="flex-1" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    )}
                    <Button className="flex-1" onClick={handleAddMedication}>
                      <Plus className="w-4 h-4 mr-2" />
                      {editingId ? 'Update Medication' : 'Add Medication'}
                    </Button>
                  </div>

                  {!editingId && (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-2 text-gray-500">Or</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="prescription-upload"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const formData = new FormData();
                              formData.append('file', file);
                              fetch('http://localhost:8000/upload', {
                                method: 'POST',
                                body: formData,
                              })
                                .then(res => res.json())
                                .then(data => alert('Prescription uploaded successfully!'))
                                .catch(err => console.error(err));
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          className="w-full border-dashed"
                          onClick={() => document.getElementById('prescription-upload')?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Prescription Image
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </Card>

              {/* Your Medications */}
              <div>
                <div className="mb-3">Your Medications</div>
                <div className="space-y-3">
                  {medications.map(med => (
                    <Card key={med.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="mb-1">{med.name}</div>
                          <div className="text-gray-500 text-sm">{med.frequency} - {med.dosage}</div>
                          <div className="text-gray-400 text-xs capitalize">{med.timeOfDay}</div>
                        </div>
                        <Badge className="bg-green-600">Active</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(med)}>
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDelete(med.id)}>
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Today's Schedule */}
              <Card className="p-4">
                <div className="mb-4">Today's Schedule</div>
                <div className="space-y-3">
                  {medications.length === 0 && (
                    <div className="text-gray-500 text-sm text-center py-4">No medications scheduled for today</div>
                  )}
                  {medications.map(med => (
                    <div key={med.id} className={`flex items-center gap-3 p-3 border rounded-lg ${med.takenToday ? 'bg-green-50 border-green-200' : ''}`}>
                      {med.takenToday ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}

                      <div className="flex-1">
                        <div className="text-sm">{getTimeDisplay(med.timeOfDay)} - {med.name}</div>
                        <div className="text-gray-500 text-xs">{med.dosage}</div>
                      </div>
                      <Button
                        size="sm"
                        variant={med.takenToday ? "default" : "outline"}
                        className={med.takenToday ? "bg-green-600 hover:bg-green-700" : ""}
                        onClick={() => handleToggleTaken(med.id)}
                      >
                        {med.takenToday ? 'Taken' : 'Take'}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="archive" className="mt-4">
              {/* Archived meds could go here */}
              <Card className="p-8 text-center">
                <div className="text-gray-500">No archived medications</div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
