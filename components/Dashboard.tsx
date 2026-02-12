import React from 'react';
import { 
  BarChart, Activity, Users, FileCheck, Search, Filter, MoreHorizontal 
} from 'lucide-react';
import { 
  FunnelChart, Funnel, Tooltip, ResponsiveContainer, LabelList, Cell 
} from 'recharts';

const data = [
  { value: 1200, name: 'Applied', fill: '#E0DAFD' },
  { value: 800, name: 'Screening', fill: '#C1B6FC' },
  { value: 350, name: 'Interview 1', fill: '#9F8EF8' },
  { value: 120, name: 'Interview 2', fill: '#7F67F4' },
  { value: 45, name: 'Offer', fill: '#6750A4' },
];

const candidates = [
  { id: 1, name: "Sarah Jenkins", role: "Senior React Dev", score: 92, status: "Interview 2", date: "2h ago" },
  { id: 2, name: "Michael Chen", role: "Backend Engineer", score: 88, status: "Screening", date: "5h ago" },
  { id: 3, name: "Amara Okeke", role: "Product Manager", score: 95, status: "Offer", date: "1d ago" },
  { id: 4, name: "David Kim", role: "Senior React Dev", score: 76, status: "Applied", date: "1d ago" },
];

const Dashboard: React.FC = () => {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-1">Recruitment Overview</h1>
            <p className="text-slate-500">Welcome back, Talent Acquisition Team.</p>
        </div>
        <button className="bg-primary-600 text-white px-6 py-3 rounded-3xl font-medium shadow-lg shadow-primary-200 hover:bg-primary-700 transition-colors">
            + Post New Job
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Active Jobs', val: '12', icon: FileCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Candidates', val: '1,245', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Avg Time-to-Hire', val: '18 Days', icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Interview Hours', val: '86h', icon: BarChart, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((kpi, i) => (
          <div key={i} className="bg-surface rounded-2xl p-6 shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">{kpi.label}</p>
              <h3 className="text-2xl font-bold text-slate-900">{kpi.val}</h3>
            </div>
            <div className={`p-3 rounded-xl ${kpi.bg}`}>
              <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart: Funnel */}
        <div className="lg:col-span-2 bg-surface rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-lg text-slate-800">Conversion Funnel</h3>
            <select className="bg-slate-50 border-none text-sm font-medium text-slate-600 rounded-lg py-1 px-3">
                <option>All Jobs</option>
                <option>Engineering</option>
                <option>Product</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Funnel
                  dataKey="value"
                  data={data}
                  isAnimationActive
                >
                  <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-lg text-slate-800 mb-6">Pending Actions</h3>
            <div className="space-y-4">
                {[1,2,3].map(i => (
                    <div key={i} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
                            JD
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900 group-hover:text-primary-600">Review John Doe's Code</p>
                            <p className="text-xs text-slate-400">Senior React Dev • 2h ago</p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Candidate List Table */}
      <div className="bg-surface rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h3 className="font-semibold text-lg text-slate-800">Recent Candidates</h3>
            <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 bg-slate-50 rounded-xl text-sm w-full border-none focus:ring-2 focus:ring-primary-200" />
                </div>
                <button className="p-2 bg-slate-50 rounded-xl text-slate-600 hover:bg-slate-100">
                    <Filter className="w-4 h-4" />
                </button>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="pb-3 pl-2 font-medium">Candidate</th>
                        <th className="pb-3 font-medium">Role</th>
                        <th className="pb-3 font-medium">AI Match</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium text-right pr-2">Actions</th>
                    </tr>
                </thead>
                <tbody className="text-sm text-slate-600">
                    {candidates.map(c => (
                        <tr key={c.id} className="border-b border-slate-50 last:border-none hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 pl-2 font-medium text-slate-900">{c.name}</td>
                            <td className="py-4">{c.role}</td>
                            <td className="py-4">
                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                    c.score > 90 ? 'bg-green-100 text-green-700' : 
                                    c.score > 80 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                    {c.score}% Match
                                </span>
                            </td>
                            <td className="py-4">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'Offer' ? 'bg-purple-500' : 'bg-slate-300'}`}></span>
                                    {c.status}
                                </span>
                            </td>
                            <td className="py-4 text-right pr-2">
                                <button className="text-slate-400 hover:text-slate-600">
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
