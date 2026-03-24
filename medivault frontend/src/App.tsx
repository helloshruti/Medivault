import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Documents } from './components/Documents';
import { Medications } from './components/Medications';
import { Symptoms } from './components/Symptoms';
import { FamilyProfiles } from './components/FamilyProfiles';
import { MobileNav } from './components/MobileNav';
import { Auth } from './components/Auth';
import { useAuth } from './context/AuthContext';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { user } = useAuth();

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'documents': return <Documents onNavigate={setCurrentPage} />;
      case 'medications': return <Medications onNavigate={setCurrentPage} />;
      case 'symptoms': return <Symptoms onNavigate={setCurrentPage} />;
      case 'family': return <FamilyProfiles onNavigate={setCurrentPage} />;
      default: return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Auth onAuthenticated={() => {}} />
      </div>
    );
  }

  const displayName = user.name.split(' ').filter((part) => !/^\d+$/.test(part)).join(' ');

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="p-4 text-xl font-semibold">Hello {displayName}</div>
      {renderPage()}
      <MobileNav currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  );
}
