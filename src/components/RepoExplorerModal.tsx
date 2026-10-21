import React, { useState } from 'react';
import {
  X,
  FileCode,
  Copy,
  Check,
  FolderTree,
  Download,
  Terminal,
  FileText,
  Code,
} from 'lucide-react';
import { REPOSITORY_FILES, RepoFile } from '../services/fileRepository';

interface RepoExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RepoExplorerModal: React.FC<RepoExplorerModalProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<RepoFile>(REPOSITORY_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Repository File Tree & Code Explorer
              </h2>
              <div className="text-[11px] text-slate-400">
                Browse, copy, or download any backend, script, or configuration file for local development
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: File Tree List */}
          <div className="w-64 md:w-80 border-r border-slate-800 bg-slate-950/70 p-3 overflow-y-auto space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Project Structure
            </div>

            {REPOSITORY_FILES.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition flex items-start gap-2 ${
                    isSelected
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <FileCode className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <div className="truncate">
                    <div className="font-mono text-[11px] truncate">{file.path}</div>
                    <div className="text-[10px] text-slate-400 truncate font-sans">
                      {file.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: File Content Viewer */}
          <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
            {/* Action Bar */}
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-white">{selectedFile.path}</span>
                <span className="text-xs text-slate-400 ml-2">({selectedFile.description})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Code
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>
            </div>

            {/* Code Textarea / Pre */}
            <div className="flex-1 p-4 overflow-auto bg-slate-950 font-mono text-xs text-slate-200 selection:bg-indigo-600 selection:text-white">
              <pre className="whitespace-pre">{selectedFile.content}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
