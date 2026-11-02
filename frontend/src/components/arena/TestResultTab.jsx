import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Terminal, 
  Loader2, 
  Play, 
  Check, 
  Copy,
  FileCode2
} from 'lucide-react';

export const TestResultTab = ({ 
  runResult, 
  isRunning, 
  onRun 
}) => {
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // 1. Loading State
  if (isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-8">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white tracking-wide">Executing Sample Tests</h4>
          <p className="text-xs text-muted-foreground">Compiling and running against public test cases...</p>
        </div>
      </div>
    );
  }

  // 2. Empty State (Haven't run yet)
  if (!runResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-8 text-muted-foreground">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Play size={20} className="opacity-50 text-neutral-400" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-300">No test results yet</p>
          <p className="text-[11px] text-muted-foreground">Click "Run Code" above to execute your logic against sample test cases.</p>
        </div>
        {onRun && (
          <button
            onClick={onRun}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary transition-all hover:scale-105 active:scale-95"
          >
            <Play size={12} />
            <span>Run Code</span>
          </button>
        )}
      </div>
    );
  }

  const { verdict: rawVerdict, execution_time_ms, compiler_output, test_results = [] } = runResult;
  const verdict = rawVerdict || (runResult.error ? 'Execution Error' : (test_results.length === 0 ? 'Execution Finished' : 'Finished'));
  const isAccepted = verdict?.toLowerCase() === 'accepted';
  const isWrongAnswer = verdict?.toLowerCase() === 'wrong answer';
  const isTLE = verdict?.toLowerCase() === 'time limit exceeded';
  const isCompilationError = verdict?.toLowerCase() === 'compilation error';

  const currentTest = test_results[selectedCaseIdx] || test_results[0] || null;

  return (
    <div className="flex flex-col h-full space-y-4">
      
      {/* High-Impact Verdict Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 shadow-lg ${
          isAccepted
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10'
            : isWrongAnswer
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-500/10'
            : isTLE
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/10'
            : isCompilationError
            ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-orange-500/10'
            : 'bg-white/5 border-white/10 text-neutral-200'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0">
            {isAccepted && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {isWrongAnswer && <XCircle className="w-5 h-5 text-rose-400" />}
            {isTLE && <Clock className="w-5 h-5 text-amber-400" />}
            {isCompilationError && <AlertTriangle className="w-5 h-5 text-orange-400" />}
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold block truncate tracking-wide">
              {verdict}
            </span>
            <span className="text-[11px] opacity-80 block truncate">
              {isAccepted
                ? `Passed all ${test_results.length} sample test cases`
                : isWrongAnswer
                ? 'Output does not match expected answer'
                : isTLE
                ? 'Execution exceeded time limit'
                : isCompilationError
                ? 'Code failed to compile'
                : 'Execution finished'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {execution_time_ms !== undefined && execution_time_ms !== null && (
            <span className="px-2 py-0.5 rounded-md bg-black/40 border border-white/10 text-xs font-mono font-medium">
              {execution_time_ms} ms
            </span>
          )}
        </div>
      </motion.div>

      {/* Compiler Output if Compilation Error */}
      {isCompilationError && compiler_output && (
        <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
            <FileCode2 size={13} /> Compiler Error Output
          </span>
          <pre className="p-3.5 rounded-lg bg-[#0d0707] border border-orange-500/20 font-mono text-xs text-orange-200 whitespace-pre-wrap overflow-x-auto leading-relaxed">
            {compiler_output}
          </pre>
        </div>
      )}

      {/* Runner Error Output */}
      {runResult.error && (
        <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Execution Notice
          </span>
          <pre className="p-3.5 rounded-lg bg-[#0d0707] border border-rose-500/20 font-mono text-xs text-rose-200 whitespace-pre-wrap overflow-x-auto leading-relaxed">
            {runResult.error}
          </pre>
        </div>
      )}

      {/* Test Case Detail View if Tests are Available */}
      {!isCompilationError && test_results.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0 space-y-3.5">
          {/* Case Pill Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar border-b border-white/5 pb-2">
            {test_results.map((test, idx) => {
              const passed = test.status?.toLowerCase() === 'accepted';
              const isSelected = selectedCaseIdx === idx;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedCaseIdx(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-white/15 text-white border border-white/30 shadow-sm'
                      : 'bg-white/[0.03] text-muted-foreground hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${passed ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.6)]'}`} />
                  <span>Case {idx + 1}</span>
                </button>
              );
            })}
          </div>

          {/* Selected Case Details */}
          {currentTest && (
            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
              
              {/* Input */}
              {currentTest.input && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    <span>Input</span>
                    <button
                      onClick={() => handleCopy(currentTest.input, 'input')}
                      className="flex items-center gap-1 hover:text-white text-[10px] normal-case font-normal"
                    >
                      {copiedField === 'input' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      <span>{copiedField === 'input' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-[#0d0d12] border border-white/5 font-mono text-xs text-neutral-200 overflow-x-auto whitespace-pre-wrap select-all">
                    {currentTest.input}
                  </pre>
                </div>
              )}

              {/* Your Output */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <span>Your Output</span>
                    {currentTest.status?.toLowerCase() === 'accepted' ? (
                      <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.2 rounded bg-emerald-500/10">Matches</span>
                    ) : (
                      <span className="text-[10px] text-rose-400 font-bold px-1.5 py-0.2 rounded bg-rose-500/10">Mismatch</span>
                    )}
                  </span>
                  <button
                    onClick={() => handleCopy(currentTest.actual_output, 'actual')}
                    className="flex items-center gap-1 hover:text-white text-[10px] normal-case font-normal"
                  >
                    {copiedField === 'actual' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedField === 'actual' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className={`p-2.5 rounded-lg border font-mono text-xs overflow-x-auto whitespace-pre-wrap select-all ${
                  currentTest.status?.toLowerCase() === 'accepted'
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                }`}>
                  {currentTest.actual_output || '<no output>'}
                </pre>
              </div>

              {/* Expected Output */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                  <span>Expected Output</span>
                  <button
                    onClick={() => handleCopy(currentTest.expected_output, 'expected')}
                    className="flex items-center gap-1 hover:text-white text-[10px] normal-case font-normal"
                  >
                    {copiedField === 'expected' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedField === 'expected' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded-lg bg-[#0d0d12] border border-white/5 font-mono text-xs text-neutral-200 overflow-x-auto whitespace-pre-wrap select-all">
                  {currentTest.expected_output || '<no output>'}
                </pre>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
};
