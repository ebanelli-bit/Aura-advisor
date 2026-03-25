import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  ShieldCheck, 
  MessageCircle, 
  ArrowRight, 
  PieChart as PieChartIcon, 
  Wallet, 
  ChevronRight,
  RefreshCcw,
  Info,
  User
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  generateRiskQuestion, 
  evaluateRiskProfile, 
  generatePortfolio, 
  chatWithAdvisor,
  type RiskProfile,
  type Portfolio,
  type Allocation
} from './services/gemini';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Step = 'welcome' | 'onboarding' | 'calculating' | 'portfolio' | 'chat' | 'research_end';

const COLORS = ['#0071E3', '#34C759', '#FF9500', '#AF52DE', '#FF3B30', '#5856D6'];

// Inserisci qui il link del tuo Google Form (Parte 2)
const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdSM3SQVILkqFwefZSHiKf7ZZ_lymaEq0Y0cv-8a828_e4dMQ/viewform?usp=header";

export default function App() {
  const [step, setStep] = useState<Step>('welcome');
  const [amount, setAmount] = useState<string>('1000');
  const [chatHistory, setChatHistory] = useState<{ role: string; text: string }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [advisorChat, setAdvisorChat] = useState<{ role: string; text: string }[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, advisorChat]);

  const startOnboarding = async () => {
    setIsLoading(true);
    setErrorStatus(null);
    
    try {
      if (isDemoMode) {
        await new Promise(r => setTimeout(r, 1000));
        const question = "Benvenuto in Aura Demo! 🌟 Per iniziare, qual è il tuo obiettivo principale per questo investimento? (es. risparmio, crescita, pensione)";
        setCurrentQuestion(question);
        setChatHistory([{ role: 'model', text: question }]);
        setStep('onboarding');
        return;
      }

      console.log("Inizio Onboarding con AI...");
      const question = await generateRiskQuestion([]);
      if (!question) throw new Error("Risposta vuota dall'IA");
      
      setCurrentQuestion(question);
      setChatHistory([{ role: 'model', text: question }]);
      setStep('onboarding');
    } catch (error: any) {
      console.error("Errore API Gemini:", error);
      const isQuotaError = error.message?.includes("429") || error.status === 429 || error.message?.includes("RESOURCE_EXHAUSTED");
      setErrorStatus(isQuotaError 
        ? "Quota API superata. Usa il tasto 'Quota' in alto per inserire la tua chiave personale e continuare senza limiti." 
        : "Aura sta riscontrando un traffico elevato. Riprova tra qualche istante.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingAnswer = async () => {
    if (!userInput.trim()) return;
    
    const newHistory = [...chatHistory, { role: 'user', text: userInput }];
    setChatHistory(newHistory);
    setUserInput('');
    setIsLoading(true);
    setErrorStatus(null);

    try {
      if (isDemoMode) {
        await new Promise(r => setTimeout(r, 1000));
        if (newHistory.length >= 4) { // Faster demo
          setStep('calculating');
          await new Promise(r => setTimeout(r, 2000));
          const demoProfile = { score: 7, label: "Crescita Dinamica", description: "Un profilo orientato alla crescita con una moderata tolleranza alle fluttuazioni." };
          setRiskProfile(demoProfile);
          setPortfolio({
            allocations: [
              { assetClass: "Azioni USA", percentage: 45, description: "S&P 500 e Tech" },
              { assetClass: "Azioni Europa", percentage: 25, description: "Blue chip europee" },
              { assetClass: "Obbligazioni", percentage: 20, description: "Titoli di stato" },
              { assetClass: "Commodities", percentage: 10, description: "Oro e materie prime" }
            ],
            totalValue: Number(amount),
            riskProfile: demoProfile,
            reasoning: "In modalità Demo, abbiamo creato un portafoglio bilanciato per mostrarti come Aura analizza i mercati! 🚀"
          });
          setStep('portfolio');
        } else {
          const demoQuestions = [
            "Ottimo! Per quanto tempo prevedi di mantenere questo investimento? ⏳",
            "Capito. Come reagiresti se il mercato scendesse del 10% in un mese? 📉",
            "Perfetto. Qual è la tua esperienza precedente con gli investimenti? 🏦"
          ];
          const nextQ = demoQuestions[Math.floor(newHistory.length / 2)] || "Grazie! Analizziamo i dati... ✨";
          setCurrentQuestion(nextQ);
          setChatHistory([...newHistory, { role: 'model', text: nextQ }]);
        }
        return;
      }

      if (newHistory.length >= 8) {
        setStep('calculating');
        const profile = await evaluateRiskProfile(newHistory);
        setRiskProfile(profile);
        const result = await generatePortfolio(profile, Number(amount));
        setPortfolio(result);
        setStep('portfolio');
      } else {
        const nextQuestion = await generateRiskQuestion(newHistory);
        if (!nextQuestion) throw new Error("Risposta vuota dall'IA");
        
        setCurrentQuestion(nextQuestion);
        setChatHistory([...newHistory, { role: 'model', text: nextQuestion }]);
      }
    } catch (error: any) {
      console.error("Errore Onboarding AI:", error);
      const isQuotaError = error.message?.includes("429") || error.status === 429 || error.message?.includes("RESOURCE_EXHAUSTED");
      setErrorStatus(isQuotaError 
        ? "Limite messaggi raggiunto. Inserisci la tua chiave API (tasto 'Quota') per sbloccare Aura." 
        : "Connessione instabile. Riprova a inviare il messaggio.");
      setChatHistory(chatHistory);
      setUserInput(userInput);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdvisorChat = async () => {
    if (!userInput.trim() || !portfolio) return;
    
    const message = userInput;
    const newHistory = [...advisorChat, { role: 'user', text: message }];
    setAdvisorChat(newHistory);
    setUserInput('');
    setIsLoading(true);
    setErrorStatus(null);
    setMessageCount(prev => prev + 1);

    try {
      if (isDemoMode) {
        await new Promise(r => setTimeout(r, 1000));
        const demoResponses = [
          "Ottima domanda! 💡 La tua allocazione in azioni è pensata proprio per cavalcare i trend di lungo periodo.",
          "Certamente! 🛡️ Le obbligazioni nel tuo portafoglio servono a proteggerti durante le fasi di volatilità.",
          "Il segreto è la diversificazione. 🌍 Con Aura, i tuoi risparmi sono distribuiti su più mercati per ridurre il rischio."
        ];
        const response = demoResponses[Math.floor(Math.random() * demoResponses.length)];
        setAdvisorChat([...newHistory, { role: 'model', text: response }]);
        return;
      }

      const response = await chatWithAdvisor(portfolio, message, advisorChat);
      setAdvisorChat([...newHistory, { role: 'model', text: response || '' }]);
    } catch (error: any) {
      console.error("Errore Advisor Chat:", error);
      const isQuotaError = error.message?.includes("429") || error.status === 429 || error.message?.includes("RESOURCE_EXHAUSTED");
      setErrorStatus(isQuotaError 
        ? "Quota esaurita. Usa una chiave API personale (tasto 'Quota') per parlare senza limiti." 
        : "L'IA è momentaneamente occupata. Riprova tra un istante.");
      setAdvisorChat(advisorChat);
      setUserInput(message);
    } finally {
      setIsLoading(false);
    }
  };

  const finishResearch = () => {
    setStep('research_end');
  };

  const returnToForm = () => {
    window.location.href = GOOGLE_FORM_URL;
  };

  const openKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-apple-gray-50 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 glass h-16 flex items-center px-4 md:px-6 justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-apple-blue rounded-lg flex items-center justify-center shrink-0">
            <TrendingUp className="text-white w-5 h-5" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Aura</span>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={() => setIsDemoMode(!isDemoMode)}
            className={cn(
              "text-[10px] md:text-xs font-bold px-2 py-1 rounded-full transition-colors",
              isDemoMode ? "bg-orange-100 text-orange-600" : "bg-apple-gray-100 text-[#86868B]"
            )}
          >
            {isDemoMode ? "DEMO ON" : "DEMO OFF"}
          </button>
          <button 
            onClick={openKeySelector}
            className="text-[10px] md:text-xs font-medium text-[#86868B] hover:text-apple-blue flex items-center gap-1"
          >
            <ShieldCheck className="w-3 h-3" />
            Quota
          </button>
          {portfolio && (
            <button 
              onClick={() => setStep('portfolio')}
              className="text-xs md:text-sm font-medium text-apple-blue hover:underline"
            >
              Portafoglio
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="text-center space-y-6 md:space-y-8 w-full"
            >
              <div className="space-y-3 md:space-y-4">
                <h1 className="text-4xl md:text-7xl font-bold tracking-tighter leading-tight">
                  Investire con <br />
                  <span className="text-apple-blue">chiarezza.</span>
                </h1>
                <p className="text-lg md:text-xl text-[#86868B] max-w-lg mx-auto px-4">
                  Aura è il tuo consulente finanziario personale, progettato per rendere l'asset allocation semplice ed elegante.
                </p>
              </div>

              <div className="glass p-6 md:p-8 rounded-3xl space-y-6 max-w-md mx-auto w-full">
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-[#86868B]">Capitale Iniziale</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl md:text-2xl font-medium">€</span>
                    <input 
                      type="number" 
                      inputMode="numeric"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 md:py-4 text-2xl md:text-3xl font-semibold bg-transparent border-b-2 border-apple-gray-100 focus:border-apple-blue outline-none transition-colors"
                    />
                  </div>
                </div>
                <button 
                  onClick={startOnboarding}
                  disabled={isLoading}
                  className="apple-button w-full flex items-center justify-center gap-2 py-3 md:py-4 text-lg"
                >
                  {isLoading ? <RefreshCcw className="animate-spin" /> : 'Inizia Ora'}
                  <ChevronRight className="w-5 h-5" />
                </button>

                {errorStatus && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs text-red-600 font-medium leading-relaxed">
                      {errorStatus}
                    </p>
                    <button 
                      onClick={startOnboarding}
                      className="mt-2 text-xs font-bold text-red-700 underline flex items-center gap-1 mx-auto"
                    >
                      <RefreshCcw className="w-3 h-3" />
                      Riprova ora
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 'onboarding' && (
            <motion.div 
              key="onboarding"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl space-y-6 md:space-y-8"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-apple-blue">
                  <ShieldCheck className="w-4 h-4 md:w-5 h-5" />
                  <span className="text-[10px] md:text-sm font-semibold uppercase tracking-widest">Analisi del Rischio</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentQuestion}</h2>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:gap-4 h-[40vh] md:h-[400px] overflow-y-auto p-3 md:p-4 rounded-2xl bg-white/50 scroll-smooth">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={cn(
                      "max-w-[85%] md:max-w-[80%] p-3 md:p-4 rounded-2xl text-sm whitespace-pre-wrap shadow-sm",
                      msg.role === 'user' ? "bg-apple-blue text-white self-end rounded-tr-none" : "bg-white text-[#1D1D1F] self-start rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="bg-white text-[#1D1D1F] self-start p-3 md:p-4 rounded-2xl text-sm animate-pulse shadow-sm">
                      Aura sta scrivendo...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="relative flex gap-2">
                  <input 
                    autoFocus
                    placeholder="Scrivi la tua risposta..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleOnboardingAnswer()}
                    className="apple-input pr-12 text-base" // text-base prevents auto-zoom on iOS
                  />
                  <button 
                    onClick={handleOnboardingAnswer}
                    disabled={isLoading || !userInput.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-apple-blue text-white rounded-full flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
                  >
                    {isLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                  </button>
                </div>

                {errorStatus && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                    <span className="text-[10px] md:text-xs text-red-600 font-medium">{errorStatus}</span>
                    <button 
                      onClick={handleOnboardingAnswer}
                      className="text-[10px] md:text-xs font-bold text-red-700 underline flex items-center gap-1"
                    >
                      <RefreshCcw className="w-3 h-3" />
                      Riprova
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 'calculating' && (
            <motion.div 
              key="calculating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-6"
            >
              <div className="relative w-16 h-16 md:w-24 h-24 mx-auto">
                <div className="absolute inset-0 border-4 border-apple-gray-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-apple-blue rounded-full border-t-transparent animate-spin"></div>
              </div>
              <div className="space-y-2 px-6">
                <h2 className="text-xl md:text-2xl font-bold">Analisi in corso</h2>
                <p className="text-sm md:text-base text-[#86868B]">Stiamo elaborando la tua strategia ottimale basata sui dati di Bloomberg e Yahoo Finance.</p>
              </div>
            </motion.div>
          )}

          {step === 'portfolio' && portfolio && (
            <motion.div 
              key="portfolio"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full space-y-6 md:space-y-8 py-4 md:py-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {/* Profile Card */}
                <div className="md:col-span-1 glass p-6 md:p-8 rounded-3xl space-y-4 md:space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#86868B]">Profilo di Rischio</span>
                    <h3 className="text-xl md:text-2xl font-bold text-apple-blue">{portfolio.riskProfile.label}</h3>
                  </div>
                  <div className="p-4 bg-apple-gray-50 rounded-2xl">
                    <p className="text-xs md:text-sm leading-relaxed">{portfolio.riskProfile.description}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-medium">
                      <span>Conservativo</span>
                      <span>Aggressivo</span>
                    </div>
                    <div className="h-2 bg-apple-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-apple-blue transition-all duration-1000 ease-out" 
                        style={{ width: `${portfolio.riskProfile.score * 10}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Chart Card */}
                <div className="md:col-span-2 glass p-6 md:p-8 rounded-3xl flex flex-col md:flex-row items-center gap-6 md:gap-8">
                  <div className="w-full h-48 md:h-64 md:w-1/2 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={portfolio.allocations}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="percentage"
                          nameKey="assetClass"
                          animationBegin={0}
                          animationDuration={800}
                        >
                          {portfolio.allocations.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/2 space-y-4">
                    <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5 text-apple-blue" />
                      Allocazione Asset
                    </h3>
                    <div className="grid grid-cols-1 gap-2 md:gap-3">
                      {portfolio.allocations.map((item, i) => (
                        <div key={i} className="flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-xs md:text-sm font-medium">{item.assetClass}</span>
                          </div>
                          <span className="text-xs md:text-sm font-bold text-[#86868B]">
                            {item.percentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Strategy Reasoning */}
              <div className="glass p-6 md:p-8 rounded-3xl space-y-4">
                <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                  <Info className="w-5 h-5 text-apple-blue" />
                  Perché questa strategia?
                </h3>
                <p className="text-base md:text-lg leading-relaxed text-[#1D1D1F]/80 italic font-serif">
                  "{portfolio.reasoning}"
                </p>
              </div>

              {/* Action */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass p-5 md:p-6 rounded-3xl">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-10 h-10 md:w-12 h-12 bg-apple-gray-100 rounded-full flex items-center justify-center shrink-0">
                    <Wallet className="text-apple-blue w-5 h-5 md:w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-sm text-[#86868B]">Investimento Totale</p>
                    <p className="text-lg md:text-xl font-bold">€{portfolio.totalValue.toLocaleString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setStep('chat')}
                  className="apple-button w-full md:w-auto flex items-center justify-center gap-2 py-3"
                >
                  <MessageCircle className="w-5 h-5" />
                  Parla con Aura
                </button>
              </div>
            </motion.div>
          )}

          {step === 'chat' && portfolio && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-3xl h-[80vh] md:h-[70vh] flex flex-col glass rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-4 md:p-6 border-b border-apple-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-10 h-10 bg-apple-blue rounded-full flex items-center justify-center text-white shrink-0">
                    <User className="w-5 h-5 md:w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm md:text-base">Aura Advisor</h3>
                    <p className="text-[10px] text-[#34C759] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-[#34C759] rounded-full animate-pulse" />
                      Disponibile ora
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setStep('portfolio')}
                  className="text-xs md:text-sm font-medium text-[#86868B] hover:text-[#1D1D1F]"
                >
                  Chiudi
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 scroll-smooth">
                <div className="bg-white p-3 md:p-4 rounded-2xl text-sm self-start max-w-[85%] md:max-w-[80%] shadow-sm border border-apple-gray-100">
                  Ciao! Sono Aura. Ho analizzato il tuo portafoglio da {portfolio.totalValue}€. 
                  Hai domande su come ho allocato i tuoi fondi o vuoi capire meglio la strategia?
                </div>
                {advisorChat.map((msg, i) => (
                  <div key={i} className={cn(
                    "max-w-[85%] md:max-w-[80%] p-3 md:p-4 rounded-2xl text-sm whitespace-pre-wrap shadow-sm",
                    msg.role === 'user' ? "bg-apple-blue text-white self-end ml-auto rounded-tr-none" : "bg-white text-[#1D1D1F] self-start rounded-tl-none border border-apple-gray-100"
                  )}>
                    {msg.text}
                  </div>
                ))}
                {isLoading && (
                  <div className="bg-white text-[#1D1D1F] self-start p-3 md:p-4 rounded-2xl text-sm animate-pulse shadow-sm border border-apple-gray-100">
                    Aura sta analizzando...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 md:p-6 bg-white/80 backdrop-blur-md border-t border-apple-gray-100">
                <div className="flex flex-col gap-3 md:gap-4">
                  {messageCount >= 2 && (
                    <button 
                      onClick={finishResearch}
                      className="text-[10px] font-semibold text-apple-blue bg-apple-blue/10 py-2 px-4 rounded-full self-center hover:bg-apple-blue/20 transition-colors active:scale-95"
                    >
                      Ho finito di esplorare, concludi sessione ✨
                    </button>
                  )}
                  <div className="relative flex gap-2">
                    <input 
                      placeholder="Chiedi ad Aura..."
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAdvisorChat()}
                      className="apple-input pr-12 text-base"
                    />
                    <button 
                      onClick={handleAdvisorChat}
                      disabled={isLoading || !userInput.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-apple-blue text-white rounded-full flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
                    >
                      {isLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                    </button>
                  </div>

                  {errorStatus && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                      <span className="text-[10px] md:text-xs text-red-600 font-medium">{errorStatus}</span>
                      <button 
                        onClick={handleAdvisorChat}
                        className="text-[10px] md:text-xs font-bold text-red-700 underline flex items-center gap-1"
                      >
                        <RefreshCcw className="w-3 h-3" />
                        Riprova
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 'research_end' && (
            <motion.div 
              key="research_end"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 md:space-y-8 max-w-md w-full px-4"
            >
              <div className="w-16 h-16 md:w-20 h-20 bg-apple-blue/10 text-apple-blue rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-8 h-8 md:w-10 h-10" />
              </div>
              <div className="space-y-3 md:space-y-4">
                <h2 className="text-2xl md:text-3xl font-bold">Sessione Completata</h2>
                <p className="text-[#86868B] text-base md:text-lg">
                  Grazie per aver testato Aura! Il tuo contributo è fondamentale per la nostra ricerca accademica.
                </p>
              </div>
              <button 
                onClick={returnToForm}
                className="apple-button w-full py-4 text-lg flex items-center justify-center gap-2 shadow-lg"
              >
                Torna al Questionario
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-[10px] text-[#86868B]">
                Cliccando il pulsante verrai reindirizzato alla parte finale del Google Form.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-[#86868B] border-t border-apple-gray-100">
        <p>© 2026 Aura RoboAdvisor AI. Solo a scopo accademico. Nessun denaro reale coinvolto.</p>
      </footer>
    </div>
  );
}
