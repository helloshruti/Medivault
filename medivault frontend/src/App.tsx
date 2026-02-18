import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Documents } from './components/Documents';
import { Medications } from './components/Medications';
import { Symptoms } from './components/Symptoms';
import { FamilyProfiles } from './components/FamilyProfiles';
import { MobileNav } from './components/MobileNav';
export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'documents':
        return <Documents onNavigate={setCurrentPage} />;
      case 'medications':
        return <Medications onNavigate={setCurrentPage} />;
      case 'symptoms':
        return <Symptoms onNavigate={setCurrentPage} />;
      case 'family':
        return <FamilyProfiles onNavigate={setCurrentPage} />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {renderPage()}
      <MobileNav currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  );
}
