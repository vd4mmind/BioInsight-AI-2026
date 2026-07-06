import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PaperCard } from './components/PaperCard';
import { StatCard } from './components/StatCard';
import { TrackerStack } from './components/TrackerStack';
import { AboutModal } from './components/AboutModal';
import { PaperData, DiseaseTopic, StudyType, Methodology, PublicationType } from './types';
import { INITIAL_PAPERS, APP_NAME, APP_VERSION } from './constants';
import { fetchLiteratureAnalysisStream, fetchAiAnalysisStream, fetchPatentStream } from './services/geminiService';
import { BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, Cell } from 'recharts';
import { RefreshCw, BookOpen, Activity, FlaskConical, Database, History, Radio, Sparkles, FileText, ArrowDownUp, FilterX, Bookmark, ServerCog, Timer, BrainCircuit, Scale } from 'lucide-react';

const App: React.FC = () => {
  // --- STATE ---
  const [archivePapers] = useState<PaperData[]>(INITIAL_PAPERS);
  const [livePapers, setLivePapers] = useState<PaperData[]>([]);
  const [aiPapers, setAiPapers] = useState<PaperData[]>([]);
  const [patentPapers, setPatentPapers] = useState<PaperData[]>([]);

  const [savedPapers, setSavedPapers] = useState<PaperData[]>(() => {
    try {
      const saved = localStorage.getItem('bioinsight_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [userRatings, setUserRatings] = useState<Record<string, 'up' | 'down'>>(() => {
    try {
      const saved = localStorage.getItem('bioinsight_ratings');
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });
  
  const [activeTab, setActiveTab] = useState<'archive' | 'live' | 'ai' | 'patents' | 'bookmarks'>('archive');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'date' | 'relevance'>('date');
  const [cooldown, setCooldown] = useState<number>(0);

  const [activeTopics, setActiveTopics] = useState<DiseaseTopic[]>(Object.values(DiseaseTopic));
  const [activeStudyTypes, setActiveStudyTypes] = useState<StudyType[]>(Object.values(StudyType));
  const [activeMethodologies, setActiveMethodologies] = useState<Methodology[]>(Object.values(Methodology));
  const [eraFilter, setEraFilter] = useState<'all' | '5years' | '1year'>('all');

  useEffect(() => {
    if (cooldown > 0) {
        const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    localStorage.setItem('bioinsight_bookmarks', JSON.stringify(savedPapers));
  }, [savedPapers]);

  useEffect(() => {
    localStorage.setItem('bioinsight_ratings', JSON.stringify(userRatings));
  }, [userRatings]);

  const currentPapers = useMemo(() => {
    switch(activeTab) {
        case 'live': return livePapers;
        case 'ai': return aiPapers;
        case 'patents': return patentPapers;
        case 'bookmarks': return savedPapers;
        default: return archivePapers;
    }
  }, [activeTab, livePapers, aiPapers, patentPapers, savedPapers, archivePapers]);

  const filteredPapers = useMemo(() => {
    const filtered = currentPapers.filter(paper => {
      const topicMatch = activeTopics.includes(paper.topic);
      const isStream = ['live', 'ai', 'patents'].includes(activeTab);
      const studyTypeMatch = isStream ? true : activeStudyTypes.includes(paper.studyType);
      const methodologyMatch = isStream ? true : activeMethodologies.includes(paper.methodology);
      
      let dateMatch = true;
      if (activeTab === 'archive') {
          const paperYear = new Date(paper.date).getFullYear();
          const currentYear = 2026; // System Context Year
          if (eraFilter === '5years') dateMatch = paperYear >= (currentYear - 5);
          if (eraFilter === '1year') dateMatch = paperYear >= (currentYear - 1);
      }

      return topicMatch && studyTypeMatch && methodologyMatch && dateMatch;
    });

    return filtered.sort((a, b) => {
        const aRating = userRatings[a.id] === 'up' ? 1 : (userRatings[a.id] === 'down' ? -1 : 0);
        const bRating = userRatings[b.id] === 'up' ? 1 : (userRatings[b.id] === 'down' ? -1 : 0);
        if (aRating !== bRating) return bRating - aRating;
        if (sortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
        return (b.validationScore - a.validationScore) || (new Date(b.date).getTime() - new Date(a.date).getTime());
    });
  }, [currentPapers, activeTopics, activeStudyTypes, activeMethodologies, eraFilter, activeTab, sortBy, userRatings]);

  const stats = useMemo(() => {
    return {
        total: filteredPapers.length,
        trials: filteredPapers.filter(p => p.studyType.includes('Trial')).length,
        aiMl: filteredPapers.filter(p => p.methodology.includes('AI/ML')).length,
        preprints: filteredPapers.filter(p => p.publicationType === PublicationType.Preprint).length,
        peerReviewed: filteredPapers.filter(p => 
            p.publicationType === PublicationType.PeerReviewed || 
            p.publicationType === PublicationType.ReviewArticle ||
            p.publicationType === PublicationType.MetaAnalysis
        ).length,
    };
  }, [filteredPapers]);

  const topicData = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(DiseaseTopic).forEach(t => counts[t] = 0);
    filteredPapers.forEach(p => {
        if (counts[p.topic] !== undefined) counts[p.topic]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).filter(i => i.value > 0);
  }, [filteredPapers]);
  
  const COLORS = ['#60A5FA', '#34D399', '#818CF8', '#F472B6', '#FBBF24', '#A78BFA', '#F87171'];

  const handleToggleBookmark = (paper: PaperData) => {
    setSavedPapers(prev => {
        const exists = prev.some(p => p.id === paper.id);
        if (exists) return prev.filter(p => p.id !== paper.id);
        return [paper, ...prev];
    });
  };

  const handleRatePaper = (paperId: string, rating: 'up' | 'down') => {
    setUserRatings(prev => {
        if (prev[paperId] === rating) {
            const copy = { ...prev };
            delete copy[paperId];
            return copy;
        }
        return { ...prev, [paperId]: rating };
    });
  };

  const handleFetchStream = async (targetTab: 'live' | 'ai' | 'patents') => {
    if (cooldown > 0) return;
    setIsLoading(true);
    setScanStatus("Launching Dual-Pulse Swarm...");
    setActiveTab(targetTab); 
    
    const searchTopics = activeTopics;
    
    try {
        let stream;
        if (targetTab === 'live') stream = fetchLiteratureAnalysisStream(searchTopics);
        else if (targetTab === 'ai') stream = fetchAiAnalysisStream(searchTopics);
        else if (targetTab === 'patents') stream = fetchPatentStream(searchTopics);

        if (!stream) return;

        let totalFetched = 0;
        let finalError = null;
        for await (const batch of stream) {
            if (batch.error) {
                finalError = batch.error;
            }
            if (batch.papers && batch.papers.length > 0) {
                const isFirstBatch = totalFetched === 0;
                totalFetched += batch.papers.length;
                setScanStatus(`Validating ${totalFetched} Scientific Signals...`);
                
                const updater = targetTab === 'live' ? setLivePapers : (targetTab === 'ai' ? setAiPapers : setPatentPapers);
                updater(prev => {
                    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const completelyNew = batch.papers.filter(np => !prev.some(op => normalize(op.title) === normalize(np.title)));
                    return [...prev, ...completelyNew];
                });
            }
        }
        
        if (finalError === 'auth') {
            setScanStatus("API key rejected — check server configuration");
        } else if (finalError === 'rate_limit') {
            setScanStatus("Rate limited, try again in a minute");
        } else if (finalError === 'Daily research quota reached, resets at midnight PT') {
            setScanStatus(finalError);
        } else if (totalFetched === 0) {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setScanStatus(`No new results — showing your last successful scan from ${timeStr}`);
        } else {
            setScanStatus("");
            setCooldown(120); 
        }
    } catch (e) {
        setScanStatus("Error during scan.");
    } finally {
        setIsLoading(false);
        setTimeout(() => setScanStatus(""), 5000);
    }
  };

  const handleTabClick = (tab: 'live' | 'ai' | 'patents' | 'archive' | 'bookmarks') => {
      setActiveTab(tab);
      if (['live', 'ai', 'patents'].includes(tab)) {
          const data = tab === 'live' ? livePapers : (tab === 'ai' ? aiPapers : patentPapers);
          if (data.length === 0 && !isLoading && cooldown === 0) handleFetchStream(tab as any);
      }
  };

  const toggleTopic = (topic: DiseaseTopic) => setActiveTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]);
  // Fix: changed 'topic' to 'type' in the filter condition
  const toggleStudyType = (type: StudyType) => setActiveStudyTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  const toggleMethodology = (methodology: Methodology) => setActiveMethodologies(prev => prev.includes(methodology) ? prev.filter(m => m !== methodology) : [...prev, methodology]);
  const handleResetFilters = () => { setActiveTopics(Object.values(DiseaseTopic)); setActiveStudyTypes(Object.values(StudyType)); setActiveMethodologies(Object.values(Methodology)); };

  const isStreamMode = ['live', 'ai', 'patents'].includes(activeTab);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col font-sans selection:bg-blue-500/30">
      <Header onOpenAbout={() => setIsAboutOpen(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
            <StatCard label="Active Items" value={stats.total} icon={<Database className="w-5 h-5 text-blue-400" />} trend={activeTab.toUpperCase()} />
            <StatCard label={activeTab === 'patents' ? "Grants" : "Peer Reviewed"} value={stats.peerReviewed} icon={activeTab === 'patents' ? <Scale className="w-5 h-5 text-green-400"/> : <BookOpen className="w-5 h-5 text-green-400" />} colorClass="text-green-400" />
            <StatCard label={activeTab === 'patents' ? "Applications" : "Preprints"} value={stats.preprints} icon={<FileText className="w-5 h-5 text-amber-400" />} colorClass="text-amber-400" />
            <StatCard label={activeTab === 'ai' ? "Cohorts" : "Clinical Trials"} value={stats.trials} icon={<Activity className="w-5 h-5 text-teal-400" />} colorClass="text-teal-400" />
            <StatCard label="AI/ML Methods" value={stats.aiMl} icon={<FlaskConical className="w-5 h-5 text-fuchsia-400" />} colorClass="text-fuchsia-400" />
             <div className="hidden xl:block col-span-3">
                 <TrackerStack daily={isStreamMode ? stats.total : 0} weekly={stats.total * 3} monthly={stats.total * 12} />
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <Sidebar activeTopics={activeTopics} toggleTopic={toggleTopic} activeStudyTypes={activeStudyTypes} toggleStudyType={toggleStudyType} activeMethodologies={activeMethodologies} toggleMethodology={toggleMethodology} eraFilter={eraFilter} setEraFilter={setEraFilter} isLiveMode={isStreamMode} />
          <div className="flex-1 min-w-0">
             <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div className="flex flex-wrap bg-slate-800 p-1 rounded-xl border border-slate-700">
                    <button onClick={() => handleTabClick('archive')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'archive' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                        <History className="w-3.5 h-3.5" /> Archive
                    </button>
                    <button onClick={() => handleTabClick('live')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'live' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                        <Radio className="w-3.5 h-3.5" /> Live Feed
                    </button>
                    <button onClick={() => handleTabClick('ai')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'ai' ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                        <BrainCircuit className="w-3.5 h-3.5" /> AI/ML Nexus
                    </button>
                    <button onClick={() => handleTabClick('patents')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'patents' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                        <Scale className="w-3.5 h-3.5" /> Patents
                    </button>
                    <button onClick={() => handleTabClick('bookmarks')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'bookmarks' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                        <Bookmark className="w-3.5 h-3.5" /> Saved
                    </button>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 gap-2">
                        <ArrowDownUp className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-400 font-medium mr-1">Sort:</span>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date' | 'relevance')} className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer appearance-none pr-4">
                            <option value="date">Latest Date</option>
                            <option value="relevance">Impact Score</option>
                        </select>
                    </div>
                    {isStreamMode && (
                        <button onClick={() => handleFetchStream(activeTab as any)} disabled={isLoading || cooldown > 0} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium transition-all ${isLoading || cooldown > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500 hover:bg-slate-700 text-slate-300'}`}>
                            {isLoading ? <ServerCog className="w-3.5 h-3.5 animate-pulse" /> : <Sparkles className="w-3.5 h-3.5 text-yellow-400" />}
                            {scanStatus ? scanStatus : cooldown > 0 ? `Resetting (${cooldown}s)` : 'Deep Scan'}
                        </button>
                    )}
                </div>
             </div>
             <div className="space-y-1">
                {isStreamMode && currentPapers.length === 0 && !isLoading && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                        {activeTab === 'ai' ? <BrainCircuit className="w-12 h-12 text-fuchsia-500 mx-auto mb-3" /> : 
                         activeTab === 'patents' ? <Scale className="w-12 h-12 text-amber-500 mx-auto mb-3" /> :
                         <Radio className="w-12 h-12 text-blue-500 mx-auto mb-3" />}
                        <h3 className="text-lg font-bold text-slate-200">System Ready for Jan 2026 Pulse</h3>
                        <p className="text-slate-400 mt-2 max-w-sm mx-auto mb-4">Launch parallel swarms to capture high-impact literature and registry signals from the last 14 days.</p>
                        <button 
                            onClick={() => handleFetchStream(activeTab as any)} 
                            disabled={cooldown > 0} 
                            className={`px-6 py-2 rounded-lg font-semibold shadow-lg transition-colors ${cooldown > 0 ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        >
                            {cooldown > 0 ? `Cooldown: ${cooldown}s` : 'Begin Intelligence Pulse'}
                        </button>
                    </div>
                )}
                {filteredPapers.map(paper => (
                    <PaperCard key={paper.id} paper={paper} isBookmarked={savedPapers.some(p => p.id === paper.id)} onToggleBookmark={() => handleToggleBookmark(paper)} userRating={userRatings[paper.id]} onRate={(rating) => handleRatePaper(paper.id, rating)} />
                ))}
             </div>
          </div>
        </div>
      </main>
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
};

export default App;