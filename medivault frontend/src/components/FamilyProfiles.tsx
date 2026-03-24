import { useState, useEffect } from 'react';
import { User, Plus, Edit, Trash2, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface FamilyProfilesProps {
  onNavigate: (page: string) => void;
}

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: number;
  gender: string;
  color: string;
  initials: string;
  active: boolean;
  medications: number;
  symptoms: number;
  documents: number;
}

const INITIAL_MEMBERS: FamilyMember[] = [
  {
    id: '1',
    name: 'Tanishka',
    relation: 'You',
    age: 25,
    gender: 'Female',
    color: 'blue',
    initials: 'T',
    active: true,
    medications: 3,
    symptoms: 3,
    documents: 5,
  },
  {
    id: '2',
    name: 'Shruti',
    relation: 'Sister',
    age: 22,
    gender: 'Female',
    color: 'purple',
    initials: 'S',
    active: false,
    medications: 2,
    symptoms: 1,
    documents: 3,
  },
  {
    id: '3',
    name: 'Trisha',
    relation: 'Mother',
    age: 52,
    gender: 'Female',
    color: 'pink',
    initials: 'Tr',
    active: false,
    medications: 5,
    symptoms: 2,
    documents: 8,
  },
];

export function FamilyProfiles({ onNavigate }: FamilyProfilesProps) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  // Load members from backend on mount
  useEffect(() => {
    fetch('http://localhost:8000/family')
      .then(res => res.json())
      .then(data => setMembers(data))
      .catch(err => console.error("Failed to load family members:", err));
  }, []);

  const saveToBackend = (newMembers: FamilyMember[]) => {
    setMembers(newMembers);
    fetch('http://localhost:8000/family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMembers),
    }).catch(err => console.error("Failed to save family members:", err));
  };

  // Form State
  const [formData, setFormData] = useState<Partial<FamilyMember>>({
    name: '',
    relation: '',
    age: 0,
    gender: '',
    color: 'blue',
  });

  const handleOpenAdd = () => {
    setEditingMember(null);
    setFormData({
      name: '',
      relation: '',
      age: 0,
      gender: '',
      color: 'blue',
      active: false,
      medications: 0,
      symptoms: 0,
      documents: 0,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (member: FamilyMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      relation: member.relation,
      age: member.age,
      gender: member.gender,
      color: member.color,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    let newMembers;
    if (editingMember) {
      // Edit existing
      newMembers = members.map(m =>
        m.id === editingMember.id
          ? { ...m, ...formData, initials: formData.name?.substring(0, 2) || '??' } as FamilyMember
          : m
      );
    } else {
      // Add new
      const newMember: FamilyMember = {
        id: Math.random().toString(36).substr(2, 9),
        name: formData.name || 'New Member',
        relation: formData.relation || 'Relative',
        age: formData.age || 0,
        gender: formData.gender || 'Unknown',
        color: formData.color || 'blue',
        initials: formData.name?.substring(0, 2) || 'NM',
        active: false,
        medications: 0,
        symptoms: 0,
        documents: 0,
      };
      newMembers = [...members, newMember];
    }
    saveToBackend(newMembers);
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this family member?')) {
      const newMembers = members.filter(m => m.id !== id);
      saveToBackend(newMembers);
    }
  };

  const handleSwitchProfile = (id: string) => {
    const newMembers = members.map(m => ({
      ...m,
      active: m.id === id
    }));
    saveToBackend(newMembers);
  };

  const activeMember = members.find(m => m.active);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1>Family Members</h1>
            <Button size="sm" onClick={handleOpenAdd}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Quick Selector */}
          <Select
            value={activeMember?.name.toLowerCase()}
            onValueChange={(value: string) => {
              const member = members.find(m => m.name.toLowerCase() === value);
              if (member) handleSwitchProfile(member.id);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Switch profile" />
            </SelectTrigger>
            <SelectContent>
              {members.map(m => (
                <SelectItem key={m.id} value={m.name.toLowerCase()}>{m.name} ({m.relation})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="p-4 space-y-4">
          {/* Family Member Cards */}
          {members.map((member) => (
            <Card key={member.id} className="p-4">
              <div className="flex items-start gap-3 mb-4">
                <Avatar className={`w-12 h-12 bg-${member.color}-100 flex-shrink-0`}>
                  <AvatarFallback className={`text-${member.color}-600`}>
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div>{member.name}</div>
                    {member.active && <Badge className="bg-green-600">Active</Badge>}
                  </div>
                  <div className="text-gray-500 text-sm">{member.relation}</div>
                  <div className="text-gray-400 text-xs">
                    {member.gender}, {member.age} years
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-2 bg-gray-50 rounded text-center">
                  <div className="text-xs text-gray-500">Meds</div>
                  <div>{member.medications}</div>
                </div>
                <div className="p-2 bg-gray-50 rounded text-center">
                  <div className="text-xs text-gray-500">Symptoms</div>
                  <div>{member.symptoms}</div>
                </div>
                <div className="p-2 bg-gray-50 rounded text-center">
                  <div className="text-xs text-gray-500">Docs</div>
                  <div>{member.documents}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {member.active ? (
                  <Button
                    className="flex-1"
                    onClick={() => onNavigate('dashboard')}
                  >
                    View Dashboard
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => handleSwitchProfile(member.id)}
                  >
                    Switch to Profile
                  </Button>
                )}
                <Button variant="outline" size="icon" onClick={() => handleOpenEdit(member)}>
                  <Edit className="w-4 h-4" />
                </Button>
                {!member.active && (
                  <Button variant="outline" size="icon" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(member.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}

          {/* Relationship Dropdown Info */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="mb-2">💡 Family Management</div>
            <div className="text-gray-600 text-sm">
              You can add and manage health records for your family members.
              Select their relationship when creating a new profile.
            </div>
          </Card>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMember ? 'Edit Family Member' : 'Add Family Member'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relation">Relationship</Label>
                <Select
                  value={formData.relation}
                  onValueChange={(value: string) => setFormData({ ...formData, relation: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Father">Father</SelectItem>
                    <SelectItem value="Mother">Mother</SelectItem>
                    <SelectItem value="Brother">Brother</SelectItem>
                    <SelectItem value="Sister">Sister</SelectItem>
                    <SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Child">Child</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value: string) => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Avatar Color</Label>
                <Select
                  value={formData.color}
                  onValueChange={(value: string) => setFormData({ ...formData, color: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select color" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="purple">Purple</SelectItem>
                    <SelectItem value="pink">Pink</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="orange">Orange</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Member</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
