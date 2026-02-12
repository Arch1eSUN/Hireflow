import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import InterviewRoom from './components/InterviewRoom';
import RuleEditor from './components/RuleEditor';
import { LayoutDashboard, Video, Settings, GitBranch, Menu } from 'lucide-react';

// Simple Hash Router Implementation for SPA
const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // If in interview mode, remove sidebar for full immersion
  if (currentRoute === 'interview') {
    return <InterviewRoom />;
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      {/* Sidebar Navigation */}
      <aside 
        className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col fixed h-full z-10`}
      >
        <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
                <GitBranch className="text-white w-5 h-5" />
            </div>
            {isSidebarOpen && <span className="font-bold text-xl text-slate-800 tracking-tight">HireFlow</span>}
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4">
            <NavItem 
                icon={LayoutDashboard} 
                label="Dashboard" 
                active={currentRoute === 'dashboard'} 
                collapsed={!isSidebarOpen}
                onClick={() => setCurrentRoute('dashboard')} 
            />
             <NavItem 
                icon={Video} 
                label="Live Interview" 
                active={currentRoute === 'interview'} 
                collapsed={!isSidebarOpen}
                onClick={() => setCurrentRoute('interview')} 
            />
             <NavItem 
                icon={GitBranch} 
                label="Screening Rules" 
                active={currentRoute === 'rules'} 
                collapsed={!isSidebarOpen}
                onClick={() => setCurrentRoute('rules')} 
            />
             <NavItem 
                icon={Settings} 
                label="Settings" 
                active={currentRoute === 'settings'} 
                collapsed={!isSidebarOpen}
                onClick={() => setCurrentRoute('settings')} 
            />
        </nav>
        
        <div className="p-4 border-t border-slate-100">
             <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 w-full flex justify-center">
                <Menu className="w-5 h-5" />
             </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {currentRoute === 'dashboard' && <Dashboard />}
        {currentRoute === 'rules' && <RuleEditor />}
        {currentRoute === 'settings' && (
            <div className="p-8 text-center text-slate-400 mt-20">
                <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-semibold">Settings Configuration</h2>
                <p>Configure API Keys (Gemini/OpenAI) and Team Permissions here.</p>
            </div>
        )}
      </main>
    </div>
  );
};

const NavItem: React.FC<{ icon: any, label: string, active: boolean, collapsed: boolean, onClick: () => void }> = ({ icon: Icon, label, active, collapsed, onClick }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
            active 
            ? 'bg-primary-50 text-primary-700' 
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        } ${collapsed ? 'justify-center' : ''}`}
    >
        <Icon className={`w-5 h-5 ${active ? 'text-primary-600' : 'group-hover:text-primary-500'}`} />
        {!collapsed && <span className="font-medium text-sm">{label}</span>}
    </button>
);

export default App;
