import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle, AlertTriangle, Play, Shield, Activity, Share2, CornerDownRight } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

// --- Types ---
type Zone = 'Human Decides' | 'AI Recommends' | 'AI Acts with Review' | 'AI Acts Autonomously' | 'Escalate to Governance';
type JudgmentLevel = 'Low' | 'High';
type ConsequenceLevel = 'Low' | 'Medium' | 'High' | 'Irreversible';

interface DecisionNode {
  id: string;
  statement: string;
  contextualJudgment?: JudgmentLevel;
  errorConsequence?: ConsequenceLevel;
  recommendedZone?: Zone;
  rationale?: string;
  finalZone?: Zone;
  accountableRole?: string;
}

type Step = 'ENTRY' | 'DECOMPOSITION' | 'CLASSIFICATION' | 'ACCOUNTABILITY' | 'REPORT';

// --- Logic ---
function getRecommendedZone(judgment: JudgmentLevel, consequence: ConsequenceLevel): { zone: Zone, rationale: string } {
  if (consequence === 'Irreversible') {
    if (judgment === 'High') {
      return { zone: 'Escalate to Governance', rationale: 'Nuanced judgment with irreversible consequences requires policy or leadership-level authorization.' };
    }
    return { zone: 'Human Decides', rationale: 'Even though judgment is specified, irreversible consequences demand full human oversight.' };
  }
  
  if (judgment === 'High') {
    if (consequence === 'High') {
      return { zone: 'Human Decides', rationale: 'High contextual judgment combined with high consequences requires direct human decision-making.' };
    }
    return { zone: 'AI Recommends', rationale: 'High judgment needs human choice, but AI can safely surface options given manageable consequences.' };
  } else {
    if (consequence === 'High') {
       return { zone: 'AI Acts with Review', rationale: 'Routine decision but high consequence means AI can propose/execute, but a human must review before it takes final effect.' };
    }
    return { zone: 'AI Acts Autonomously', rationale: 'Highly specified rules with low-to-medium consequences are perfect for autonomous AI execution.' };
  }
}

const ZONES: Zone[] = ['Human Decides', 'AI Recommends', 'AI Acts with Review', 'AI Acts Autonomously', 'Escalate to Governance'];

const ZONE_COLORS: Record<Zone, string> = {
  'Human Decides': 'bg-zone-human text-white',
  'AI Recommends': 'bg-zone-recommends text-white',
  'AI Acts with Review': 'bg-zone-review text-white',
  'AI Acts Autonomously': 'bg-zone-autonomous text-white',
  'Escalate to Governance': 'bg-zone-escalate text-white'
};

const BORDER_COLORS: Record<Zone, string> = {
  'Human Decides': 'border-zone-human',
  'AI Recommends': 'border-zone-recommends',
  'AI Acts with Review': 'border-zone-review',
  'AI Acts Autonomously': 'border-zone-autonomous',
  'Escalate to Governance': 'border-zone-escalate'
};

// Default mock nodes for testing / demo mode
const MOCK_NODES: DecisionNode[] = [
  { id: '1', statement: 'Evaluate applicant credit risk profile' },
  { id: '2', statement: 'Determine initial loan approval tier' },
  { id: '3', statement: 'Flag high-risk anomalies for fraud review' },
  { id: '4', statement: 'Send final approval communication to customer' }
];

export default function App() {
  const [step, setStep] = useState<Step>('ENTRY');
  
  // Data State
  const [processDesc, setProcessDesc] = useState('');
  const [nodes, setNodes] = useState<DecisionNode[]>([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [roles, setRoles] = useState<Record<Zone, string>>({} as Record<Zone, string>);
  
  // UI State
  const [isExtracting, setIsExtracting] = useState(false);

  // --- Actions ---
  const handleExtractNodes = async () => {
    if (!processDesc.trim()) return;
    setIsExtracting(true);
    
    try {
      const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("No API key found. Using mock data.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `You are a decision architecture tool. A user has provided this business process: "${processDesc}".
Extract 4 to 8 discrete decision points within this process.
Each decision node must be a specific action or judgment.
Output only JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                statement: { type: Type.STRING }
              },
              required: ["id", "statement"]
            }
          }
        }
      });
      
      const generatedNodes: DecisionNode[] = JSON.parse(response.text || '[]');
      if (generatedNodes.length > 0) {
        setNodes(generatedNodes);
      } else {
        setNodes(MOCK_NODES);
      }
    } catch (err) {
      console.error(err);
      setNodes(MOCK_NODES); // Fallback to mock data if API fails or no key
    } finally {
      setIsExtracting(false);
      setCurrentNodeIndex(0);
      setStep('DECOMPOSITION');
    }
  };

  const current = nodes[currentNodeIndex];

  const updateCurrentNode = (updates: Partial<DecisionNode>) => {
    const newNodes = [...nodes];
    newNodes[currentNodeIndex] = { ...current, ...updates };
    setNodes(newNodes);
  };

  const handleClassify = () => {
    if (!current.contextualJudgment || !current.errorConsequence) return;
    const rec = getRecommendedZone(current.contextualJudgment, current.errorConsequence);
    updateCurrentNode({ recommendedZone: rec.zone, rationale: rec.rationale });
    setStep('CLASSIFICATION');
  };

  const handleAcceptOrOverride = (zone: Zone) => {
    updateCurrentNode({ finalZone: zone });
    if (currentNodeIndex < nodes.length - 1) {
      setCurrentNodeIndex(currentNodeIndex + 1);
      setStep('DECOMPOSITION');
    } else {
      setStep('ACCOUNTABILITY');
    }
  };

  const handleRolesSubmit = () => {
    setStep('REPORT');
  };

  // --- Sub-Renders ---
  
  const renderEntry = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
      className="max-w-2xl mx-auto space-y-8 py-20"
    >
      <div className="space-y-4">
        <h1 className="font-display text-5xl tracking-tight leading-tight">Human-AI Decision Rights Mapper</h1>
        <p className="text-xl text-ink/70 font-accent font-light leading-relaxed">
          Unclear accountability is the primary source of poor organizational decisions. 
          Map out the decision boundaries before AI agents enter your workflow.
        </p>
      </div>
      
      <div className="card space-y-6">
        <div>
          <span className="label">The Process</span>
          <textarea 
            value={processDesc}
            onChange={e => setProcessDesc(e.target.value)}
            placeholder="Describe the business process in plain language (e.g., 'We evaluate loan applications and decide whether to approve, decline, or escalate...')"
            className="w-full h-32 p-4 bg-warm border border-ink/20 focus:border-ink/50 focus:ring-0 outline-none resize-none font-medium font-accent"
          />
        </div>
        
        <button 
          onClick={handleExtractNodes}
          disabled={!processDesc.trim() || isExtracting}
          className="flex items-center space-x-2 bg-ink text-warm px-6 py-3 font-semibold disabled:opacity-50 hover:bg-ink/90 transition-colors"
        >
          {isExtracting ? (
            <span className="flex items-center space-x-2"><Activity className="animate-spin w-5 h-5"/> <span>Decomposing Process...</span></span>
          ) : (
            <span className="flex items-center space-x-2"><span>Generate Architecture Map</span> <ArrowRight className="w-4 h-4"/></span>
          )}
        </button>
      </div>
    </motion.div>
  );

  const renderDecomposition = () => (
    <motion.div 
      key={`decomp-${currentNodeIndex}`}
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      className="max-w-3xl mx-auto py-20"
    >
      <div className="label">
        Decision Node {currentNodeIndex + 1} of {nodes.length}
      </div>
      <h2 className="font-display text-4xl mb-12">{current.statement}</h2>
      
      <div className="space-y-12">
        {/* Q1 */}
        <div className="space-y-4">
          <label className="block text-lg font-medium font-accent">1. Contextual Judgment required?</label>
          <p className="text-sm text-ink/60 mb-4">How often does this decision require nuance that is hard to specify in rules?</p>
          <div className="grid grid-cols-2 gap-4">
             {([
               { val: 'Low', desc: 'Highly specified, rules-based, routine' }, 
               { val: 'High', desc: 'Nuanced, ambiguous, requires human context' }
             ] as {val: JudgmentLevel, desc: string}[]).map(opt => (
               <button 
                 key={opt.val}
                 onClick={() => updateCurrentNode({ contextualJudgment: opt.val })}
                 className={`p-4 border text-left transition-all ${current.contextualJudgment === opt.val ? 'border-ink bg-ink/5 shadow-md' : 'border-ink/20 hover:border-ink/50 bg-white'}`}
               >
                 <div className="font-bold text-lg">{opt.val}</div>
                 <div className="text-sm text-ink/60 mt-1">{opt.desc}</div>
               </button>
             ))}
          </div>
        </div>

        {/* Q2 */}
        <div className="space-y-4">
          <label className="block text-lg font-medium font-accent">2. Consequence of error?</label>
          <p className="text-sm text-ink/60 mb-4">What happens if this decision is made incorrectly?</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {(['Low', 'Medium', 'High', 'Irreversible'] as ConsequenceLevel[]).map(val => (
               <button 
                 key={val}
                 onClick={() => updateCurrentNode({ errorConsequence: val })}
                 className={`p-4 border text-center transition-all ${current.errorConsequence === val ? 'border-ink bg-ink/5 shadow-md' : 'border-ink/20 hover:border-ink/50 bg-white'}`}
               >
                 <div className="font-semibold">{val}</div>
               </button>
             ))}
          </div>
        </div>
      </div>

      <div className="mt-12 flex justify-end">
        <button 
          onClick={handleClassify}
          disabled={!current.contextualJudgment || !current.errorConsequence}
          className="bg-ink text-warm px-8 py-3 font-semibold disabled:opacity-30 transition-opacity"
        >
          Classify Decision
        </button>
      </div>
    </motion.div>
  );

  const renderClassification = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="max-w-3xl mx-auto py-20"
    >
      <div className="label">
        Zone Recommendation
      </div>
      <h2 className="font-display text-4xl mb-8 leading-tight">{current.statement}</h2>

      <div className="card p-0 shadow-lg relative overflow-hidden">
        {/* Card Header matching zone color */}
        <div className={`h-2 w-full ${ZONE_COLORS[current.recommendedZone!]}`}></div>
        
        <div className="p-8 space-y-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-4">
            <div>
              <span className="label">Recommended Assignment</span>
              <div className={`inline-block px-3 py-1 text-sm font-semibold tracking-wide uppercase ${ZONE_COLORS[current.recommendedZone!]}`}>
                {current.recommendedZone}
              </div>
            </div>
            
            <div className="text-left md:text-right text-sm text-ink/60 bg-warm px-4 py-2 font-mono whitespace-nowrap">
              <span className="block">{current.contextualJudgment} Judgment</span>
              <span className="block">{current.errorConsequence} Consequence</span>
            </div>
          </div>

          <div className="rationale-text font-accent text-balance">
            "{current.rationale}"
          </div>

          <div className="pt-8 border-t border-[var(--line)]">
            <span className="label">Accept or Override</span>
            <div className="flex flex-col space-y-2 mt-4">
              <button 
                onClick={() => handleAcceptOrOverride(current.recommendedZone!)}
                className="w-full flex justify-between items-center bg-ink text-warm px-6 py-4 font-semibold hover:bg-ink/90 transition"
              >
                <span>Accept Recommendation</span>
                <CheckCircle className="w-5 h-5"/>
              </button>
              
              <div className="text-xs uppercase tracking-widest text-center text-ink/40 py-2">Or Override To</div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {ZONES.filter(z => z !== current.recommendedZone).map(z => (
                  <button 
                    key={z}
                    onClick={() => handleAcceptOrOverride(z)}
                    className={`text-xs border p-2 font-medium transition text-center flex items-center justify-center min-h-12 border-ink/20 hover:bg-ink/5`}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderAccountability = () => {
    // Unique zones used
    const uniqueZones: Zone[] = Array.from(new Set(nodes.map(n => n.finalZone!)));
    
    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="max-w-3xl mx-auto py-20"
      >
        <h2 className="font-display text-4xl mb-4">Accountability Assignment</h2>
        <p className="font-accent text-ink/70 mb-10 text-lg text-balance">
          Decisions without an owner create organizational drift. Name the role 
          accountable for the outcomes in each assigned zone.
        </p>

        <div className="space-y-6">
          {uniqueZones.map(zone => (
            <div key={zone} className="node shadow-sm flex-col md:flex-row md:items-center gap-6 hover:shadow-md transition">
              <div className="md:w-1/3 w-full">
                <div className={`inline-block text-center w-full px-3 py-2 text-xs font-semibold tracking-wide uppercase ${ZONE_COLORS[zone]}`}>
                  {zone}
                </div>
              </div>
              <div className="md:w-2/3">
                <input 
                  type="text"
                  placeholder="e.g. Risk Manager, Credit Policy Committee..."
                  className="w-full border-b-2 border-ink/20 focus:border-ink bg-transparent py-2 outline-none font-accent font-medium text-lg placeholder:text-ink/30 transition-colors"
                  value={roles[zone] || ''}
                  onChange={(e) => setRoles({...roles, [zone]: e.target.value})}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-end">
          <button 
            onClick={handleRolesSubmit}
            className="flex items-center space-x-2 bg-ink text-warm px-8 py-3 font-semibold hover:bg-ink/90 transition-colors"
          >
            <span>Generate Rights Map</span>
            <Play className="w-4 h-4 fill-current"/>
          </button>
        </div>
      </motion.div>
    );
  };

  const renderReport = () => {
    // Risk calculations
    const highRiskAutonomy = nodes.filter(n => n.finalZone === 'AI Acts Autonomously' && (n.errorConsequence === 'High' || n.errorConsequence === 'Irreversible'));
    const uniqueZones: Zone[] = Array.from(new Set(nodes.map(n => n.finalZone!)));
    const missingRoles = uniqueZones.filter(z => !roles[z] || roles[z].trim() === '');
    const autonomousCount = nodes.filter(n => n.finalZone === 'AI Acts Autonomously').length;
    const autonomousRatio = autonomousCount / Math.max(1, nodes.length);

    const riskFlags = [];
    if (highRiskAutonomy.length > 0) riskFlags.push({
      title: 'High-Consequence Autonomy',
      desc: 'You mapped AI to act autonomously on decisions with High or Irreversible consequences.',
      rec: 'Change High consequence actions to "AI Acts with Review". Change Irreversible to "Escalate".'
    });
    if (missingRoles.length > 0) riskFlags.push({
      title: 'Accountability Void',
      desc: `No role assigned for ${missingRoles.length} active decision zone(s).`,
      rec: 'A process without named owners defaults to the developer. Name a business owner.'
    });
    if (autonomousRatio > 0.6) riskFlags.push({
      title: 'Automation Bias Risk',
      desc: `Over ${(autonomousRatio * 100).toFixed(0)}% of this process is fully autonomous.`,
      rec: 'Ensure human override mechanisms exist monitoring the aggregate output of the process.'
    });

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto py-10 px-4 pb-32"
      >
        <div className="flex justify-between items-end mb-12 border-b border-[var(--line)] pb-8">
          <div>
            <span className="label">Final Deliverable</span>
            <h1 className="font-display text-4xl sm:text-5xl">Decision Rights Map</h1>
          </div>
          <button className="hidden sm:flex items-center space-x-2 border border-[var(--line)] px-4 py-2 hover:bg-ink/5 transition text-sm font-semibold rounded">
            <Share2 className="w-4 h-4"/> <span>Share Brief</span>
          </button>
        </div>

        {/* Hero Visual Map */}
        <div className="card relative overflow-hidden sm:p-10 mb-16">
           {/* Abstract grid bg */}
           <div className="absolute inset-0 editorial-grid opacity-30 pointer-events-none"></div>
           
           <div className="relative z-10 space-y-4">
             {nodes.map((n, i) => {
               // Extract zone color
               let dotColor = 'var(--blue)'; // Human
               if (n.finalZone === 'AI Recommends') dotColor = 'var(--amber)';
               if (n.finalZone === 'AI Acts with Review') dotColor = 'var(--orange)';
               if (n.finalZone === 'AI Acts Autonomously') dotColor = 'var(--green)';
               if (n.finalZone === 'Escalate to Governance') dotColor = 'var(--red)';

               return (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  key={n.id} 
                  className="node relative z-10 hover:shadow-md transition"
                >
                  <div className="flex items-center flex-1">
                    <div className="zone-dot shrink-0" style={{ background: dotColor }}></div>
                    <div>
                      <span className="font-medium font-accent text-lg">{n.statement}</span>
                      {roles[n.finalZone!] && (
                        <div className="flex items-center space-x-2 text-xs font-semibold text-ink/60 mt-1">
                          <Shield className="w-3 h-3"/> <span>{roles[n.finalZone!]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`shrink-0 ml-4 text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-widest ${ZONE_COLORS[n.finalZone!]}`}>
                    {n.finalZone}
                  </div>
                </motion.div>
             )})}
           </div>
        </div>

        {/* Risk Flags */}
        {riskFlags.length > 0 && (
          <div className="mb-16">
            <h3 className="font-accent text-2xl font-semibold mb-6 flex items-center space-x-2">
               <AlertTriangle className="text-red-600 w-6 h-6"/>
               <span>Governance Risk Flags</span>
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {riskFlags.map((flag, i) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + (i * 0.1) }}
                  key={i}
                  className="bg-[#fff7ed] border border-[#fed7aa] p-6 shadow-sm"
                >
                   <div className="font-bold text-amber-900 mb-2">{flag.title}</div>
                   <div className="text-sm font-medium text-amber-800/80 mb-5 leading-relaxed">{flag.desc}</div>
                   <div className="border-t border-[#fed7aa] pt-4 flex items-start space-x-2">
                      <CornerDownRight className="w-4 h-4 text-orange-600 mt-0.5 shrink-0"/>
                      <div className="text-[11px] font-black uppercase tracking-wider text-orange-700">{flag.rec}</div>
                   </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
        
        {/* Restart */}
        <div className="text-center pt-10 border-t border-ink/10">
          <button 
            onClick={() => { setStep('ENTRY'); setProcessDesc(''); setNodes([]); setRoles({} as Record<Zone,string>); }}
            className="text-xs font-bold uppercase tracking-widest text-ink hover:text-ink/60 transition"
          >
            Start New Map
          </button>
        </div>

      </motion.div>
    );
  };

  return (
    <div className="min-h-screen relative font-sans text-ink">
      <div className="fixed inset-0 editorial-grid pointer-events-none opacity-50 bg-warm mix-blend-multiply"></div>
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-full overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div 
             key={step}
             initial={{ opacity: 0, y: 15 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -15, transition: { duration: 0.2 } }}
             transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {step === 'ENTRY' && renderEntry()}
            {step === 'DECOMPOSITION' && renderDecomposition()}
            {step === 'CLASSIFICATION' && renderClassification()}
            {step === 'ACCOUNTABILITY' && renderAccountability()}
            {step === 'REPORT' && renderReport()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
