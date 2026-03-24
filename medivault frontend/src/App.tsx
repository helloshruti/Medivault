import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Documents } from "./components/Documents";
import { Medications } from "./components/Medications";
import { Symptoms } from "./components/Symptoms";
import { FamilyProfiles } from "./components/FamilyProfiles";
import { MobileNav } from "./components/MobileNav";
import { Auth } from "./components/Auth";
import { AuthProvider, useAuth } from "./context/AuthContext";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [familyRefreshToken, setFamilyRefreshToken] = useState(0);

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return (
          <Dashboard
            onNavigate={setCurrentPage}
            familyRefreshToken={familyRefreshToken}
          />
        );
      case "documents":
        return <Documents onNavigate={setCurrentPage} />;
      case "medications":
        return <Medications onNavigate={setCurrentPage} />;
      case "symptoms":
        return <Symptoms onNavigate={setCurrentPage} />;
      case "family":
        return (
          <FamilyProfiles
            onNavigate={setCurrentPage}
            onFamilyChanged={() =>
              setFamilyRefreshToken((previous) => previous + 1)
            }
          />
        );
      default:
        return (
          <Dashboard
            onNavigate={setCurrentPage}
            familyRefreshToken={familyRefreshToken}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Auth onAuthenticated={() => { }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {renderPage()}
      <MobileNav currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
