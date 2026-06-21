import React, { useState, useRef } from 'react';

export default function UploadModal({ isOpen, onClose, dbService, onTriggerReload }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [manualText, setManualText] = useState('');
  const [amount, setAmount] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgressText, setAuditProgressText] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      // Auto fill description with file name for convenience
      setManualText(`Receipt upload: ${droppedFile.name}`);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setManualText(`Receipt upload: ${selectedFile.name}`);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalReceiptText = manualText || (file ? `Receipt file: ${file.name}` : '');
    if (!finalReceiptText) {
      alert("Please provide receipt details or upload a file.");
      return;
    }

    setIsAuditing(true);
    setAuditProgressText("AI Accountant: Uploading receipt to sandbox...");

    // Stage 1: Uploading
    await new Promise(r => setTimeout(r, 600));
    setAuditProgressText("AI Accountant: Analyzing receipt layout with Gemini...");

    // Stage 2: OCR/Parsing
    await new Promise(r => setTimeout(r, 600));
    setAuditProgressText("AI Accountant: Running business eligibility check...");

    // Stage 3: Audit complete & database updates
    await new Promise(r => setTimeout(r, 800));

    try {
      const amtInput = amount ? parseFloat(amount) : null;
      await dbService.simulateReceiptUpload(finalReceiptText, amtInput);
      onTriggerReload();
      onClose();
    } catch (err) {
      alert("Error auditing receipt: " + err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-md flex items-center justify-center z-50 animate-fadeIn px-4">
      <div 
        className="bg-white w-full max-w-lg rounded-[32px] border border-[#ebebeb] shadow-[0_24px_64px_rgba(0,0,0,0.16)] overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-black tracking-tight">Audit New Bill or Receipt</h3>
            <p className="text-xs text-slate-500 mt-0.5">Let the AI Accountant categorize and provision tax write-offs.</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black flex items-center justify-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Audit Progress Overlay */}
        {isAuditing && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
            {/* Spinning Agent Brain Accent */}
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-black animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black text-black">AI</span>
              </div>
            </div>
            <h4 className="text-sm font-bold text-black uppercase tracking-wider">Agent Classification Loop</h4>
            <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed font-mono">
              {auditProgressText}
            </p>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 pt-2 space-y-5">
          {/* Drag & Drop File Zone */}
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
            className={`w-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${
              dragActive 
                ? "border-black bg-slate-50" 
                : file 
                ? "border-emerald-500 bg-emerald-50/20" 
                : "border-[#e5e7eb] hover:border-slate-400 hover:bg-slate-50/50"
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept="image/*,.pdf,.txt"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="text-center space-y-1 px-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs font-bold text-emerald-800 truncate max-w-xs">{file.name}</p>
                <p className="text-[10px] text-emerald-600">{(file.size / 1024).toFixed(1)} KB · File Staged</p>
              </div>
            ) : (
              <div className="text-center space-y-1.5 px-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <p className="text-xs font-bold text-slate-800">Drag & drop your receipt, or <span className="text-black underline">browse files</span></p>
                <p className="text-[10px] text-slate-400">Supports PNG, JPG, PDF, TXT (Max 5MB)</p>
              </div>
            )}
          </div>

          {/* Description Manual Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Expense Description / Receipt Text</label>
            <textarea
              required
              rows="3"
              placeholder="e.g. AWS server billing for hosting user database. Or paste raw OCR text."
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              className="w-full bg-slate-50 text-slate-900 text-xs px-4 py-3 rounded-xl border border-[#ebebeb] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"
            />
          </div>

          {/* Amount and Action */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">Amount (Optional)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 text-xs font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Auto-extracts"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs px-7 py-2.5 rounded-xl border border-[#ebebeb] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-black hover:bg-neutral-800 text-white text-xs font-bold py-3 rounded-xl transition-all shadow-sm hover:shadow"
              >
                Submit to Audit
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
