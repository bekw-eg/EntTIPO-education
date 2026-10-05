"use client";
import { useAccount } from "@/components/providers/AccountProvider";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Bot,
  Lightbulb,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  Send,
  RotateCcw,
  ArrowRight,
  BrainCircuit,
  MessageSquare,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MathDisplay } from "@/components/ui/MathDisplay";
import { AiMessageRenderer } from "./AiMessageRenderer";
import { Question, PracticeQuestion, AiAction, AiErrorAnalysis, AiSimilarQuestion } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { errorText } from '@/lib/i18n/messages';
import { toast } from "sonner";

export interface AiTutorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  question?: Question | PracticeQuestion | null;
  stepAnswers?: Record<string, string>;
  hasAttempted?: boolean;
  initialAction?: AiAction;
  initialStructuredError?: AiErrorAnalysis | null;
  attemptId?: string;
  sessionId?: string;
  onHintUsed?: (questionId: string) => void;
  topicId?: string;
  formulaLatex?: string;
  formulaName?: string;
}

interface MessageItem {
  id: string;
  role: "ai" | "user";
  text?: string;
  action?: AiAction;
  hintLevel?: number;
  structuredError?: AiErrorAnalysis;
  similarQuestion?: AiSimilarQuestion;
}

/**
 * Sanitizes KaTeX math formulas and markdown formatting into natural spoken text.
 */
function cleanMathForSpeech(text: string, locale: string): string {
  if (!text) return "";
  let s = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, " $1 ")
    .replace(/\$([^\$]+)\$/g, " $1 ")
    .replace(/\\\[([\s\S]*?)\\\]/g, " $1 ")
    .replace(/\\\(([^\)]+)\\\)/g, " $1 ");

  if (locale === "ru") {
    s = s
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, " $1 делить на $2 ")
      .replace(/\\sqrt\{([^}]+)\}/g, " корень из $1 ")
      .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, " корень степени $1 из $2 ")
      .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, " интеграл от $1 до $2 ")
      .replace(/\\cdot/g, " умножить на ")
      .replace(/\\times/g, " умножить на ")
      .replace(/\\pm/g, " плюс-минус ")
      .replace(/\\le/g, " меньше или равно ")
      .replace(/\\ge/g, " больше или равно ")
      .replace(/\\neq/g, " не равно ")
      .replace(/\\pi/g, " пи ")
      .replace(/\\log_\{([^}]+)\}/g, " логарифм по основанию $1 ")
      .replace(/\\ln/g, " натуральный логарифм ")
      .replace(/\\sin/g, " синус ")
      .replace(/\\cos/g, " косинус ")
      .replace(/\\tan/g, " тангенс ")
      .replace(/\^\{([^}]+)\}/g, " в степени $1 ")
      .replace(/\^([0-9a-zA-Z])/g, " в степени $1 ")
      .replace(/_\{([^}]+)\}/g, " с индексом $1 ");
  } else if (locale === "kk") {
    s = s
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, " $1 бөлінген $2 ")
      .replace(/\\sqrt\{([^}]+)\}/g, " $1 түбірі ")
      .replace(/\\cdot/g, " көбейту ")
      .replace(/\\times/g, " көбейту ")
      .replace(/\\pm/g, " плюс-минус ")
      .replace(/\\le/g, " кіші немесе тең ")
      .replace(/\\ge/g, " үлкен немесе тең ")
      .replace(/\\neq/g, " тең емес ")
      .replace(/\\pi/g, " пи ")
      .replace(/\\sin/g, " синус ")
      .replace(/\\cos/g, " косинус ")
      .replace(/\\tan/g, " тангенс ")
      .replace(/\^\{([^}]+)\}/g, " дәрежесі $1 ")
      .replace(/\^([0-9a-zA-Z])/g, " дәрежесі $1 ");
  } else {
    s = s
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, " $1 divided by $2 ")
      .replace(/\\sqrt\{([^}]+)\}/g, " square root of $1 ")
      .replace(/\\cdot/g, " times ")
      .replace(/\\times/g, " times ")
      .replace(/\\pm/g, " plus minus ")
      .replace(/\\le/g, " less than or equal to ")
      .replace(/\\ge/g, " greater than or equal to ")
      .replace(/\\neq/g, " not equal to ")
      .replace(/\\pi/g, " pi ")
      .replace(/\\sin/g, " sine ")
      .replace(/\\cos/g, " cosine ")
      .replace(/\\tan/g, " tangent ")
      .replace(/\^\{([^}]+)\}/g, " to the power of $1 ")
      .replace(/\^([0-9a-zA-Z])/g, " to the power of $1 ");
  }

  return s
    .replace(/[*_#`~>]/g, "")
    .replace(/[{}\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function AiTutorPanel({
  isOpen,
  onClose,
  question,
  stepAnswers = {},
  hasAttempted = false,
  initialAction,
  initialStructuredError,
  attemptId,
  sessionId,
  onHintUsed,
  topicId,
  formulaLatex,
  formulaName,
}: AiTutorPanelProps) {
  const { t, locale, getTopicName } = useLanguage();
  const { user } = useAccount();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [currentHintLevel, setCurrentHintLevel] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

  // Audio TTS & Voice input states
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Similar question practice state
  const [userPracticeAns, setUserPracticeAns] = useState("");
  const [practiceChecked, setPracticeChecked] = useState(false);
  const [practiceIsCorrect, setPracticeIsCorrect] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // History belongs to an account, even when two students solve the same question.
  const storageKey = !user ? null : question?.id
    ? `enttipo_ai_user_${user.id}_q_${question.id}_${locale}`
    : topicId
    ? `enttipo_ai_user_${user.id}_topic_${topicId}_${locale}`
    : null;
  const contextKey = `${storageKey}:${sessionId || ""}`;
  const currentContext = useRef(contextKey);
  currentContext.current = contextKey;

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Clean up audio speech and voice recognition on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Handle panel open: restore cached history or execute initial action
  useEffect(() => {
    if (!isOpen) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingMessageId(null);
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
      return;
    }

    let cancelled = false;
    setMessages([]);
    setHistoryKey(null);
    setCurrentHintLevel(1);
    setIsLoading(false);
    const restore = async () => {
      let cachedHistory: { messages?: MessageItem[]; currentHintLevel?: number } | null = null;
      if (storageKey && typeof window !== "undefined") {
        try {
          // Preserve the old untagged dialog in RU; never import it into a KK conversation.
          const cached = localStorage.getItem(storageKey) ?? (locale === 'ru' ? localStorage.getItem(storageKey.replace(/_ru$/, '')) : null);
          if (cached) cachedHistory = JSON.parse(cached);
        } catch (err) {
          // Blocked storage must not prevent the tutor from making a fresh request.
          console.warn("Failed to load AI dialog history from localStorage:", err);
        }
      }
      if (Array.isArray(cachedHistory?.messages) && cachedHistory.messages.length > 0) {
        if (question && cachedHistory.messages.some((m) => m?.role === "ai" && m.action === "hint")) {
          try {
            if (sessionId) {
              const res = await fetch(`/api/sessions/${sessionId}/hint`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ questionId: question.id }),
              });
              if (!res.ok) throw new Error("Could not record cached hint usage");
            }
            onHintUsed?.(question.id);
          } catch {
            if (!cancelled) toast.error(t.session.hintError);
            return;
          }
        }
        if (cancelled) return;
        setHistoryKey(contextKey);
        setMessages(cachedHistory.messages);
        if ([1, 2, 3].includes(cachedHistory.currentHintLevel ?? 0)) {
          setCurrentHintLevel(cachedHistory.currentHintLevel!);
        }
        return;
      }

      if (cancelled) return;
      setHistoryKey(contextKey);
      if (initialStructuredError) {
        setMessages([
          {
            id: "initial-error",
            role: "ai",
            action: "analyze_error",
            structuredError: initialStructuredError,
            text: initialStructuredError.shortExplanation,
          },
        ]);
      } else if (initialAction) {
        void handleAction(initialAction);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [isOpen, storageKey, sessionId, initialAction, initialStructuredError, question?.id]);

  // Persist conversation history to localStorage when messages change
  useEffect(() => {
    if (storageKey && historyKey === contextKey && typeof window !== "undefined" && messages.length > 0) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            messages,
            currentHintLevel,
            savedAt: Date.now(),
          })
        );
      } catch (err) {
        console.warn("Failed to persist AI dialog history:", err);
      }
    }
  }, [messages, currentHintLevel, storageKey, historyKey, contextKey]);

  // Clear dialog history
  const handleClearHistory = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);

    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.removeItem(storageKey);
        if (locale === 'ru') localStorage.removeItem(storageKey.replace(/_ru$/, ''));
      } catch (err) {
        console.warn("Failed to clear AI dialog history:", err);
      }
    }
    setMessages([]);
    setCurrentHintLevel(1);
    toast.success(t.ai.historyCleared);
  };

  // Text to speech toggling
  const handleToggleSpeech = (messageId: string, rawText: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error(locale === 'kk' ? 'Бұл браузер мәтінді дыбыстауды қолдамайды.' : 'Этот браузер не поддерживает озвучивание текста.');
      return;
    }

    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const spokenText = cleanMathForSpeech(rawText, locale);
    if (!spokenText) return;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    const langCode = locale === "kk" ? "kk-KZ" : locale === "en" ? "en-US" : "ru-RU";
    utterance.lang = langCode;

    // Pick best matching voice
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = locale === "kk" ? "kk" : locale === "en" ? "en" : "ru";
    const matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => {
      setSpeakingMessageId(null);
    };

    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
    setSpeakingMessageId(messageId);
  };

  // Voice speech-to-text recognition
  const hasSpeechRec =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const handleToggleListening = () => {
    if (!hasSpeechRec) {
      toast.error(t.ai.voiceNotSupported);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognitionRef.current = recognition;

    recognition.lang = locale === "kk" ? "kk-KZ" : locale === "en" ? "en-US" : "ru-RU";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((res: any) => res[0].transcript)
        .join("");
      setInputMessage(transcript);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        toast.error(locale === 'kk' ? 'Микрофонға қолжетімділік бұғатталған.' : 'Доступ к микрофону заблокирован');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  const handleAction = async (action: AiAction, customLevel?: number, userMsg?: string) => {
    setIsLoading(true);
    const targetHintLevel = customLevel ?? (action === "hint" ? currentHintLevel : undefined);

    // If user sent a chat message, add it to chat history
    if (action === "chat" && userMsg) {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: "user",
          text: userMsg,
        },
      ]);
    }

    try {
      const payload: any = {
        action,
        language: locale,
        questionId: question?.id,
        topicId: topicId || question?.topicId,
        attemptId,
        sessionId,
        stepAnswers,
        hintLevel: targetHintLevel,
        userMessage: userMsg,
        formulaLatex,
        formulaName,
      };

      // Add user's currently entered answers
      const currentAns = Object.values(stepAnswers).filter(Boolean).join("; ");
      if (currentAns) {
        payload.userAnswer = currentAns;
      }

      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "AI Service Error");
      }

      const data = await res.json();

      if (currentContext.current !== contextKey) return;
      if (action === "hint" && question) onHintUsed?.(question.id);
      setHistoryKey(contextKey);

      if (action === "hint" && data.hintLevel) {
        setCurrentHintLevel(data.hintLevel);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "ai",
          action: data.action,
          text: data.text,
          hintLevel: data.hintLevel,
          structuredError: data.structuredError,
          similarQuestion: data.similarQuestion,
        },
      ]);

      // Reset practice widget if similar question received
      if (data.similarQuestion) {
        setUserPracticeAns("");
        setPracticeChecked(false);
        setPracticeIsCorrect(false);
      }
    } catch (err: any) {
      if (currentContext.current !== contextKey) return;
      console.error("AI Tutor action error:", err);
      toast.error(errorText(err.message, locale));
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "ai",
          text: errorText(err.message, locale),
        },
      ]);
    } finally {
      if (currentContext.current === contextKey) setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    const trimmed = inputMessage.trim();
    if (!trimmed || isLoading) return;
    setInputMessage("");
    handleAction("chat", undefined, trimmed);
  };

  const checkPracticeAnswer = (expected: string) => {
    if (!userPracticeAns.trim()) return;
    const cleanUser = userPracticeAns.trim().toLowerCase().replace(/\s+/g, "");
    const cleanExp = expected.trim().toLowerCase().replace(/\s+/g, "");

    const isMatch =
      cleanUser === cleanExp ||
      cleanUser === cleanExp.replace(/[()]/g, "") ||
      cleanUser.replace(/,/g, ".") === cleanExp.replace(/,/g, ".");

    setPracticeIsCorrect(isMatch);
    setPracticeChecked(true);
  };

  if (!isOpen) return null;

  return (
    <aside
      role="complementary"
      aria-label={t.ai.tutorTitle}
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-background border-l shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right"
    >
      {/* Top Header */}
      <header className="p-4 border-b flex items-center justify-between bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base leading-tight">
              {t.ai.tutorTitle}
            </h3>
            <p className="text-xs text-muted-foreground">
              {question?.topic?.name ? getTopicName(question.topic.name) : t.ai.tutorSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearHistory}
              className="rounded-lg h-8 w-8 text-muted-foreground hover:text-foreground"
              title={t.ai.clearHistory}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-lg h-8 w-8 text-muted-foreground hover:text-foreground"
            title={t.ai.close}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Quick Action Chips */}
      <div className="p-3 border-b bg-muted/20 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max pb-1">
          {/* Level 1 Hint */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("hint", 1)}
            disabled={isLoading}
            className="text-xs h-7 rounded-full bg-background/80 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
          >
            <Lightbulb className="w-3 h-3 mr-1 text-amber-500" />
            {t.ai.giveHint}
          </Button>

          {/* Explain Condition Simpler */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("explain")}
            disabled={isLoading}
            className="text-xs h-7 rounded-full bg-background/80 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
          >
            <HelpCircle className="w-3 h-3 mr-1 text-blue-500" />
            {t.ai.explainCondition}
          </Button>

          {/* Why Formula */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("why_formula")}
            disabled={isLoading}
            className="text-xs h-7 rounded-full bg-background/80 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
          >
            <BookOpen className="w-3 h-3 mr-1 text-emerald-500" />
            {t.ai.whyFormula}
          </Button>

          {/* Check Steps */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("check_steps")}
            disabled={isLoading}
            className="text-xs h-7 rounded-full bg-background/80 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
          >
            <CheckCircle2 className="w-3 h-3 mr-1 text-purple-500" />
            {t.ai.checkSteps}
          </Button>

          {/* Where did I make a mistake */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("where_mistake")}
            disabled={isLoading}
            className="text-xs h-7 rounded-full bg-background/80 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
          >
            <AlertCircle className="w-3 h-3 mr-1 text-rose-500" />
            {t.ai.whereMistake}
          </Button>

          {/* Explain Topic */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("explain_topic")}
            disabled={isLoading}
            className="text-xs h-7 rounded-full bg-background/80 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
          >
            <BrainCircuit className="w-3 h-3 mr-1 text-indigo-500" />
            {t.ai.explainTopic}
          </Button>

          {/* Similar Question */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("similar_question")}
            disabled={isLoading}
            className="text-xs h-7 rounded-full bg-background/80 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
          >
            <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
            {t.ai.similarQuestion}
          </Button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && !isLoading && (
          <div className="py-12 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">{t.ai.tutorTitle}</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                {t.ai.tutorSubtitle}. {locale === 'kk' ? 'Жоғарыдағы әрекетті таңдаңыз немесе төменде дауыспен не мәтінмен сұрақ қойыңыз.' : locale === 'en' ? 'Choose an action above or ask a question below using voice or text.' : 'Выберите быстрое действие сверху или задайте вопрос голосом или текстом ниже.'}
              </p>
            </div>
          </div>
        )}

        {(historyKey === contextKey ? messages : []).map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {m.role === "user" ? (
              <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-tr-xs text-sm max-w-[85%] shadow-xs">
                {m.text}
              </div>
            ) : (
              <div className="space-y-3 w-full max-w-full">
                {/* AI Card */}
                <div className="p-4 rounded-2xl bg-card border shadow-xs space-y-3">
                  {/* Badge for Level or Action + TTS Audio Read Button */}
                  <div className="flex items-center justify-between gap-2 border-b pb-2">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">
                        {t.ai.tutorTitle}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {m.text && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleSpeech(m.id, m.text || "")}
                          className={`h-6 w-6 rounded-full transition-colors ${
                            speakingMessageId === m.id
                              ? "text-primary bg-primary/10 animate-pulse"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                          title={speakingMessageId === m.id ? t.ai.stopAudio : t.ai.readAloud}
                        >
                          {speakingMessageId === m.id ? (
                            <VolumeX className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}

                      {m.action === "hint" && (
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-semibold ${
                            m.hintLevel === 1
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : m.hintLevel === 2
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {m.hintLevel === 1
                            ? t.ai.level1Badge
                            : m.hintLevel === 2
                            ? t.ai.level2Badge
                            : t.ai.level3Badge}
                        </Badge>
                      )}

                      {m.action === "analyze_error" && (
                        <Badge variant="destructive" className="text-[10px]">
                          {t.ai.aiAnalysisTitle}
                        </Badge>
                      )}

                      {m.action === "similar_question" && (
                        <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-400">
                          {t.ai.additionalPractice}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Structured Error Analysis View */}
                  {m.structuredError && (
                    <div className="space-y-3 text-xs bg-muted/30 p-3 rounded-xl border">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-muted-foreground">
                          {t.ai.weakSkillLabel}:
                        </span>
                        <Badge variant="outline" className="font-mono text-xs font-semibold">
                          {m.structuredError.weakSkill}
                        </Badge>
                      </div>

                      <div>
                        <span className="font-semibold text-rose-600 dark:text-rose-400 block mb-0.5">
                          {t.ai.reasonLabel}:
                        </span>
                        <p className="text-foreground/90">{m.structuredError.reason}</p>
                      </div>

                      {m.structuredError.hint && (
                        <div>
                          <span className="font-semibold text-amber-600 dark:text-amber-400 block mb-0.5">
                            {t.ai.adviceLabel}:
                          </span>
                          <p className="text-foreground/90">{m.structuredError.hint}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main AI Explanation Text with LaTeX */}
                  {m.text && <AiMessageRenderer content={m.text} />}

                  {/* Hint Stepper Controls */}
                  {m.action === "hint" && m.hintLevel && m.hintLevel < 3 && (
                    <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        {m.hintLevel === 1
                          ? (locale === 'kk' ? 'Нақтырақ түсіндіру керек пе?' : locale === 'en' ? 'Need more detail?' : "Нужно больше конкретики?")
                          : (locale === 'kk' ? 'Әлі де қиын ба?' : locale === 'en' ? 'Still difficult?' : "Всё ещё сложно?")}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {m.hintLevel === 1 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAction("hint", 2)}
                            disabled={isLoading}
                            className="text-xs h-7"
                          >
                            {t.ai.nextHint} (Level 2)
                          </Button>
                        )}
                        {(hasAttempted || m.hintLevel === 2) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction("hint", 3)}
                            disabled={isLoading}
                            className="text-xs h-7 font-medium"
                          >
                            {t.ai.showFullBreakdown}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Similar Question Practice Interactive Box */}
                  {m.similarQuestion && (
                    <div className="mt-3 p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-purple-700 dark:text-purple-300">
                          {m.similarQuestion.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {t.ai.notAffectMastery}
                        </span>
                      </div>

                      <p className="text-foreground/90 font-medium">
                        {m.similarQuestion.questionText}
                      </p>

                      {m.similarQuestion.latex && (
                        <div className="p-2.5 bg-background rounded-lg border text-center font-medium overflow-x-auto">
                          <MathDisplay math={m.similarQuestion.latex} block={false} />
                        </div>
                      )}

                      {/* Interactive check */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder={t.ai.enterAnswer}
                            value={userPracticeAns}
                            onChange={(e) => setUserPracticeAns(e.target.value)}
                            className="text-xs h-8 font-mono bg-background"
                          />
                          <Button
                            size="sm"
                            onClick={() =>
                              checkPracticeAnswer(m.similarQuestion!.expectedAnswer)
                            }
                            className="text-xs h-8 shrink-0 px-3"
                          >
                            {t.ai.checkPracticeAnswer}
                          </Button>
                        </div>

                        {practiceChecked && (
                          <div
                            className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                              practiceIsCorrect
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {practiceIsCorrect ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-1">
                              <p className="font-semibold">
                                {practiceIsCorrect
                                  ? t.ai.practiceCorrect
                                  : t.ai.practiceIncorrect}
                              </p>
                              {m.similarQuestion.explanation && (
                                <p className="text-[11px] opacity-90 whitespace-pre-line">
                                  {m.similarQuestion.explanation}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="p-4 rounded-2xl bg-card border flex items-center gap-3 text-xs text-muted-foreground animate-pulse">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            <span>{t.ai.loading}</span>
          </div>
        )}
      </div>

      {/* Bottom Chat Bar with Voice Input (STT) */}
      <footer className="p-3 border-t bg-card/80 backdrop-blur-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* Voice Input Microphone Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleListening}
            className={`h-9 w-9 p-0 shrink-0 rounded-lg transition-all ${
              isListening
                ? "bg-rose-500/15 border-rose-500 text-rose-500 animate-pulse hover:bg-rose-500/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={isListening ? t.ai.voiceListening : t.ai.voiceInput}
          >
            {isListening ? (
              <MicOff className="w-4 h-4 text-rose-500" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>

          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={isListening ? t.ai.voiceListening : t.ai.askPlaceholder}
            disabled={isLoading}
            className="text-xs h-9 bg-background flex-1"
          />

          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !inputMessage.trim()}
            className="h-9 px-3 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </footer>
    </aside>
  );
}
