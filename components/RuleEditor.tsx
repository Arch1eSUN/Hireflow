import React, { useState } from 'react';
import { Plus, Trash2, Save, Play } from 'lucide-react';
import { RuleNode, RuleOperator } from '../types';
import { DEFAULT_ENGINEER_RULE, evaluateRule } from '../services/rules/ruleEngine';

const RuleEditor: React.FC = () => {
  const [rule, setRule] = useState<RuleNode>(DEFAULT_ENGINEER_RULE);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  // Mock candidate for testing
  const mockCandidate = {
    name: "John Doe",
    experience_years: 4,
    skills: ["React", "TypeScript", "Node.js"]
  };

  const handleTest = () => {
    const result = evaluateRule(mockCandidate, rule);
    setTestResult(result);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">Screening Logic Builder</h2>
            <p className="text-slate-500">Define criteria for automated resume filtering.</p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={handleTest}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-2xl hover:bg-blue-100 transition-colors"
            >
                <Play className="w-4 h-4" /> Test Rule
            </button>
            <button className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-2xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200">
                <Save className="w-4 h-4" /> Save Logic
            </button>
        </div>
      </div>

      <div className="bg-surface border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <RuleGroupNode node={rule} onChange={setRule} />
      </div>

      {testResult !== null && (
        <div className={`p-4 rounded-xl border flex items-center justify-between ${testResult ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <span>
                Test against <strong>{mockCandidate.name}</strong> (Exp: {mockCandidate.experience_years}, Skills: {mockCandidate.skills.join(', ')})
            </span>
            <span className="font-bold uppercase">{testResult ? 'PASS' : 'FAIL'}</span>
        </div>
      )}
    </div>
  );
};

// Recursive Component for Rule Groups/Conditions
const RuleGroupNode: React.FC<{ node: RuleNode; onChange: (n: RuleNode) => void; onDelete?: () => void }> = ({ node, onChange, onDelete }) => {
  
  if (node.type === 'condition') {
    return (
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-8">IF</span>
        <input 
            value={node.field} 
            onChange={e => onChange({ ...node, field: e.target.value })}
            className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-sm w-40" 
            placeholder="Field (e.g. gpa)"
        />
        <select 
            value={node.operator} 
            onChange={e => onChange({ ...node, operator: e.target.value as RuleOperator })}
            className="bg-slate-50 border-none rounded-lg px-2 py-1.5 text-sm font-mono text-slate-600"
        >
            <option value="EQUALS">==</option>
            <option value="GTE">&gt;=</option>
            <option value="LTE">&lt;=</option>
            <option value="CONTAINS">contains</option>
        </select>
        <input 
            value={node.value} 
            onChange={e => onChange({ ...node, value: e.target.value })}
            className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-sm flex-1" 
            placeholder="Value"
        />
        <button onClick={onDelete} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Group Logic
  return (
    <div className="pl-4 border-l-2 border-slate-200 space-y-4">
      <div className="flex items-center gap-3">
        <select 
            value={node.operator}
            onChange={e => onChange({ ...node, operator: e.target.value as RuleOperator })} 
            className="bg-primary-50 text-primary-700 font-bold text-sm rounded-lg px-3 py-1.5 border border-primary-100"
        >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
        </select>
        <button 
            onClick={() => {
                const newChild: RuleNode = { id: Math.random().toString(), type: 'condition', field: '', operator: 'EQUALS', value: '' };
                onChange({ ...node, children: [...(node.children || []), newChild] });
            }}
            className="text-xs flex items-center gap-1 text-slate-500 hover:text-primary-600 font-medium px-2 py-1 rounded hover:bg-slate-50 transition-colors"
        >
            <Plus className="w-3 h-3" /> Add Condition
        </button>
         {onDelete && (
             <button onClick={onDelete} className="p-1 text-slate-300 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
            </button>
         )}
      </div>
      
      <div className="space-y-3">
        {node.children?.map((child, idx) => (
            <RuleGroupNode 
                key={child.id} 
                node={child} 
                onChange={(updatedChild) => {
                    const newChildren = [...(node.children || [])];
                    newChildren[idx] = updatedChild;
                    onChange({ ...node, children: newChildren });
                }}
                onDelete={() => {
                     const newChildren = (node.children || []).filter((_, i) => i !== idx);
                     onChange({ ...node, children: newChildren });
                }}
            />
        ))}
      </div>
    </div>
  );
};

export default RuleEditor;
