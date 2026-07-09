'use client';

import { useState, useEffect } from 'react';
import { 
  CloudUpload, Sparkles, Folder, List, 
  CheckCircle2, Clock, Download, ChevronRight,
  Upload, FileText, Bot
} from 'lucide-react';
import { getAllUserMatters } from '@/app/actions/matters';

type Matter = {
  id: string;
  name: string;
  client: string;
  value: string;
  status: string;
  createdAt: Date | string;
  submission?: {
    targetDirectory: string;
    practiceArea: string;
  };
};

export default function MattersAssistantPage() {
  const [activeTab, setActiveTab] = useState<'assistant' | 'repository'>('assistant');
  const [matters, setMatters] = useState<Matter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State for Assistant
  const [directory, setDirectory] = useState('Chambers');
  const [guideRegion, setGuideRegion] = useState('');
  const [practiceArea, setPracticeArea] = useState('Banking & Finance');
  const [jurisdiction, setJurisdiction] = useState('Mexico');
  const [looseNotes, setLooseNotes] = useState('');

  useEffect(() => {
    if (activeTab === 'repository') {
      loadMatters();
    }
  }, [activeTab]);

  async function loadMatters() {
    setIsLoading(true);
    const res = await getAllUserMatters();
    if (res.success && res.data) {
      setMatters(res.data);
    }
    setIsLoading(false);
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-[#1A237E]" />
          Matters Assistant
        </h1>
        <p className="text-gray-500 mt-2 text-lg">
          Turn your scattered inputs into publishable matters, or manage your portfolio.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-200/50 p-1 rounded-lg w-max mb-8">
        <button
          onClick={() => setActiveTab('assistant')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'assistant' 
              ? 'bg-white text-[#1A237E] shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          <Bot className="h-4 w-4" />
          <span>AI Assistant</span>
        </button>
        <button
          onClick={() => setActiveTab('repository')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'repository' 
              ? 'bg-white text-[#1A237E] shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          <Folder className="h-4 w-4" />
          <span>Matters Repository</span>
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'assistant' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-start space-x-4 mb-8 bg-[#E8EAF6] p-4 rounded-lg border border-[#C5CAE9]">
              <div className="bg-[#1A237E] p-2 rounded-full flex-shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-[#1A237E]">RankPilot · Matters Assistant</h3>
                <p className="text-sm text-gray-600 mt-1">
                  The more sources you provide, the more complete the matter will be. Upload documents (PDF, DOCX) or simply paste loose text and attorney notes below. We will structure it perfectly.
                </p>
              </div>
            </div>

            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Matter Context</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Directory</label>
                <select 
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-[#1A237E] focus:border-[#1A237E]"
                  value={directory} onChange={e => setDirectory(e.target.value)}
                >
                  <option>Chambers</option>
                  <option>Legal 500</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Practice Area</label>
                <select 
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-[#1A237E] focus:border-[#1A237E]"
                  value={practiceArea} onChange={e => setPracticeArea(e.target.value)}
                >
                  <option>Banking & Finance</option>
                  <option>Corporate / M&A</option>
                  <option>Dispute Resolution</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jurisdiction</label>
                <input 
                  type="text" 
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-[#1A237E] focus:border-[#1A237E]"
                  value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Dropzone */}
              <div className="md:col-span-2 space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                  <CloudUpload className="h-10 w-10 text-[#1A237E] mb-3" />
                  <h4 className="text-lg font-bold text-gray-900">Drag files here or click</h4>
                  <p className="text-sm text-gray-500 mt-1">Maximum 10 files · up to 25MB each</p>
                  <div className="flex gap-2 mt-4">
                    <span className="bg-white border border-gray-200 text-xs font-bold px-2 py-1 rounded text-[#1A237E]">PDF</span>
                    <span className="bg-white border border-gray-200 text-xs font-bold px-2 py-1 rounded text-[#1A237E]">DOCX</span>
                    <span className="bg-white border border-gray-200 text-xs font-bold px-2 py-1 rounded text-[#1A237E]">TXT</span>
                  </div>
                </div>
                
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-medium uppercase tracking-wider">or paste text / emails directly</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <textarea 
                  rows={6}
                  placeholder="Paste a forwarded email, partner notes, deal description, or any loose text..."
                  className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-[#1A237E] focus:border-[#1A237E] p-4"
                  value={looseNotes}
                  onChange={e => setLooseNotes(e.target.value)}
                ></textarea>
              </div>

              {/* Sidebar Sources */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                <FileText className="h-12 w-12 text-gray-300 mb-3" />
                <h4 className="font-bold text-gray-700">No sources yet</h4>
                <p className="text-sm text-gray-500 text-center mt-2">Add files or paste text to get started.</p>
              </div>
            </div>

          </div>

          <div className="flex justify-end pt-4">
            <button className="bg-[#1A237E] hover:bg-[#121858] text-white px-6 py-3 rounded-md font-bold shadow-md transition-colors flex items-center gap-2 opacity-50 cursor-not-allowed" disabled>
              <Sparkles className="h-4 w-4" />
              Generate Matter (v3)
            </button>
          </div>
        </div>
      )}

      {activeTab === 'repository' && (
        <div className="animate-in fade-in duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Portfolio & Extracted Matters</h2>
                <p className="text-sm text-gray-500 mt-1">Review all matters automatically extracted from your builders or manually processed.</p>
              </div>
            </div>
            
            {isLoading ? (
              <div className="p-12 text-center text-gray-500">Loading your repository...</div>
            ) : matters.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <List className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                No matters found in your repository yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Matter Details</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Builder Reference</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {matters.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-[#1A237E]">{m.name}</div>
                          <div className="text-sm text-gray-500 mt-1">Client: {m.client} | Value: {m.value}</div>
                        </td>
                        <td className="px-6 py-4">
                          {m.submission ? (
                            <div>
                              <div className="font-medium text-gray-900">{m.submission.targetDirectory}</div>
                              <div className="text-xs text-gray-500">{m.submission.practiceArea}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Independent</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          {m.status === 'AI Optimized' ? (
                            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold border border-green-200">
                              <CheckCircle2 className="h-3.5 w-3.5" /> AI Optimized
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200">
                              <Clock className="h-3.5 w-3.5" /> Draft
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
