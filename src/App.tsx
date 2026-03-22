/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { Player } from '@remotion/player';
import { BirthdayVideo } from './remotion/BirthdayVideo';
import { X, Download, Loader2, Calendar, ArrowLeft, MessageCircle, Share2, Sparkles, PartyPopper, Cake } from 'lucide-react';
import { getAudioDurationInSeconds } from '@remotion/media-utils';
import { staticFile } from 'remotion';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';

interface Student {
  Name: string;
  DOB: string;
  Mobile: string;
}

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // YYYY-MM-DD local
  });
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [videoDuration, setVideoDuration] = useState(439); // 14.63 seconds at 30fps
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isBirthdayOnDate = (dob: string | undefined, targetDateStr: string) => {
    if (!dob) return false;
    const normalizedDOB = dob.trim().replace(/\//g, '-');
    const parts = normalizedDOB.split('-');
    if (parts.length !== 3) return false;

    let stuDay, stuMonth;
    if (parts[0].length === 4) {
      stuDay = parts[2];
      stuMonth = parts[1];
    } else {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      if (p0 > 12) {
        stuDay = parts[0];
        stuMonth = parts[1];
      } else if (p1 > 12) {
        stuDay = parts[1];
        stuMonth = parts[0];
      } else {
        stuDay = parts[0];
        stuMonth = parts[1];
      }
    }

    const [tYear, tMonth, tDay] = targetDateStr.split('-');
    return parseInt(stuDay, 10) === parseInt(tDay, 10) && 
           parseInt(stuMonth, 10) === parseInt(tMonth, 10);
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDate = new Date();
  const todayStr = formatDate(todayDate);
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(todayDate.getDate() + 1);
  const tomorrowStr = formatDate(tomorrowDate);

  const todayCount = students.filter(s => isBirthdayOnDate(s.DOB, todayStr)).length;
  const tomorrowCount = students.filter(s => isBirthdayOnDate(s.DOB, tomorrowStr)).length;

  // Filter students by selected date (matching DD-MM)
  const filteredStudents = useMemo(() => 
    students.filter(student => isBirthdayOnDate(student.DOB, selectedDate)),
    [students, selectedDate]
  );

  useEffect(() => {
    if (!isLoading && filteredStudents.length > 0 && canvasRef.current) {
      const myConfetti = confetti.create(canvasRef.current, {
        resize: true,
        useWorker: true
      });

      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        myConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        myConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
      
      return () => {
        clearInterval(interval);
        myConfetti.reset();
      };
    }
  }, [isLoading, filteredStudents.length]);



  const fetchStudents = () => {
    setIsLoading(true);
    console.log("Fetching students...");
    fetch('/api/students')
      .then(res => {
        console.log("Response received:", res.status);
        return res.json();
      })
      .then(data => {
        console.log("Data received:", data.length, "students");
        setStudents(data);
      })
      .catch(err => {
        console.error("Fetch error:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleDownload = async (studentName: string) => {
    setIsDownloading(studentName);
    try {
      // We use a POST request to trigger the render. 
      // The server will respond with the video file once it's ready.
      const response = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Use a safe filename
        const safeName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeName}_Birthday.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to render video: ${errorData.details || errorData.error || 'Unknown error'}. Please try again.`);
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Error during download. The server might be busy or the video is taking too long to render. Please try again in a moment.');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    if (filteredStudents.length === 0) return;
    
    setIsDownloadingAll(true);
    setDownloadProgress({ current: 0, total: filteredStudents.length });
    
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      for (let i = 0; i < filteredStudents.length; i++) {
        const student = filteredStudents[i];
        setDownloadProgress({ current: i + 1, total: filteredStudents.length });
        
        try {
          const response = await fetch('/api/render-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentName: student.Name }),
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const safeName = student.Name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            zip.file(`${safeName}_Birthday.mp4`, blob);
          } else {
            console.error(`Failed to render video for ${student.Name}`);
          }
        } catch (err) {
          console.error(`Error rendering ${student.Name}:`, err);
        }
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Birthdays_${selectedDate || 'All'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download all error:', error);
      alert('Error during batch download. Please try again.');
    } finally {
      setIsDownloadingAll(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  const getBirthdayMessage = (studentName: string) => {
    return `🎉🎂 Happy Birthday, ${studentName}! 🎂🎉

Wishing you a day filled with joy 😊, laughter 😄, and wonderful surprises 🎁✨

May you continue to shine bright 🌟 in your studies 📚 and achieve great success 🏆 in life 🚀

🎓 – Brilliant Group of School 🎓`;
  };

  const handleWhatsAppShare = (studentName: string) => {
    setIsSharing(studentName);
    setShareFile(null);
    setShareError(null);
    
    // Start rendering automatically
    renderForShare(studentName);
  };

  const renderForShare = async (studentName: string) => {
    try {
      const response = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const safeName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const file = new File([blob], `${safeName}_Birthday.mp4`, { type: 'video/mp4' });
        setShareFile(file);
      } else {
        throw new Error('Failed to render video');
      }
    } catch (err) {
      console.error('Error rendering for share:', err);
      setShareError('Failed to prepare video. You can still share the text message.');
    }
  };

  const executeShare = async () => {
    if (!isSharing) return;
    
    const message = getBirthdayMessage(isSharing);
    
    try {
      const canShareFiles = navigator.share && shareFile && 
        (typeof navigator.canShare === 'function' ? navigator.canShare({ files: [shareFile] }) : true);

      if (canShareFiles) {
        await navigator.share({
          files: [shareFile],
          text: message,
        });
        setIsSharing(null);
        setShareFile(null);
      } else {
        // Fallback to text only
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
        setShareError("Your browser doesn't support sharing videos directly. We've opened WhatsApp with the message. Please download the video separately to share it.");
      }
    } catch (err) {
      console.error('Error executing share:', err);
      if ((err as Error).name !== 'AbortError') {
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
        setShareError("Sharing failed. You can share the message now, and download the video manually if needed.");
      }
    }
  };

  const handleNativeShare = async (studentName: string) => {
    const message = getBirthdayMessage(studentName);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Birthday Wish for ${studentName}`,
          text: message,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(message);
        alert('Birthday message copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div className="p-6 bg-[#fafafa] min-h-screen font-sans relative overflow-hidden">
      <canvas 
        ref={canvasRef} 
        className="fixed inset-0 pointer-events-none z-[100] w-full h-full"
      />
      {/* Dynamic background elements */}
      <div className="absolute top-[-10%] left-[-5%] w-[40vw] h-[40vw] bg-pink-200/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] bg-indigo-200/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[20%] right-[10%] w-[20vw] h-[20vw] bg-amber-100/30 rounded-full blur-[80px]" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-8">
          <div className="relative">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-pink-50 text-pink-600 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-pink-100/50 shadow-sm"
            >
              <Sparkles size={10} />
              Brilliant Group of Schools
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-[0.95]"
            >
              Birthday<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600">Magic.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-slate-400 mt-4 font-medium text-base max-w-md leading-relaxed"
            >
              Celebrate your students' special moments with personalized AI-generated birthday videos.
            </motion.p>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-3 w-full md:w-auto"
          >
            <div className="bg-white p-4 rounded-3xl shadow-lg shadow-pink-100/20 border border-white flex flex-col justify-between min-w-[140px] relative overflow-hidden group hover:scale-105 transition-transform">
              <div className="absolute -right-3 -top-3 text-pink-50 opacity-20 group-hover:rotate-12 transition-transform">
                <Cake size={60} />
              </div>
              <span className="text-[9px] font-black text-pink-400 uppercase tracking-widest">Today</span>
              <div className="mt-2">
                <span className="text-3xl font-black text-slate-900">{todayCount}</span>
                <span className="text-[10px] font-bold text-slate-400 ml-2">Stars</span>
              </div>
            </div>
            <div className="bg-slate-900 p-4 rounded-3xl shadow-lg shadow-slate-200/20 border border-slate-800 flex flex-col justify-between min-w-[140px] relative overflow-hidden group hover:scale-105 transition-transform">
              <div className="absolute -right-3 -top-3 text-slate-800 opacity-40 group-hover:rotate-12 transition-transform">
                <PartyPopper size={60} />
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tomorrow</span>
              <div className="mt-2">
                <span className="text-3xl font-black text-white">{tomorrowCount}</span>
                <span className="text-[10px] font-bold text-slate-500 ml-2">Stars</span>
              </div>
            </div>
          </motion.div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 mb-10">
          <div className="bg-white/60 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-xl shadow-indigo-100/20">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-md shadow-indigo-200">
                  <Calendar size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Select Date</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Finding Birthdays</p>
                </div>
              </div>
              
              <div className="w-full sm:w-auto">
                <input 
                  id="celebration-date"
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  onClick={(e) => (e.target as any).showPicker?.()}
                  className="w-full sm:w-auto bg-slate-100 px-4 py-3 rounded-xl font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer text-base"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {filteredStudents.length > 0 && (
                <button 
                  onClick={handleDownloadAll}
                  disabled={isDownloadingAll}
                  className="flex-1 sm:flex-none bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200 disabled:opacity-50"
                >
                  {isDownloadingAll ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Downloading ({downloadProgress.current}/{downloadProgress.total})
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      Download All ({filteredStudents.length})
                    </>
                  )}
                </button>
              )}
              <button 
                onClick={fetchStudents}
                className="p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
                title="Refresh List"
              >
                <Loader2 size={24} className={isLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-6 rounded-3xl text-white shadow-xl shadow-pink-200/50 relative overflow-hidden flex flex-col justify-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 blur-xl" />
            
            <h3 className="text-2xl font-black leading-tight mb-3">
              Found {filteredStudents.length}<br />
              Birthday Stars!
            </h3>
            <p className="text-pink-100 font-medium text-xs leading-relaxed opacity-80">
              {filteredStudents.length > 0 
                ? "Ready to make their day special? You can preview, download or share their personalized videos below."
                : "No birthdays found for this date. Try selecting another day to celebrate!"}
            </p>
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-md rounded-3xl overflow-hidden border border-white/50 shadow-xl shadow-slate-200/20">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Student Info</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Celebration</th>
                  <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-8 py-24 text-center text-slate-400">
                      <div className="relative w-16 h-16 mx-auto mb-6">
                        <Loader2 size={64} className="animate-spin text-pink-500 absolute inset-0" />
                        <div className="absolute inset-0 flex items-center justify-center text-2xl">🎂</div>
                      </div>
                      <p className="font-bold text-slate-500">Preparing the party list...</p>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-8 py-24 text-center">
                      <div className="text-6xl mb-6 animate-bounce">🎈</div>
                      <p className="font-bold text-slate-400">No student data found in the database.</p>
                    </td>
                  </tr>
                ) : filteredStudents.length > 0 ? (
                  filteredStudents.map((student, index) => (
                    <motion.tr 
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group hover:bg-white transition-all"
                    >
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-50 to-indigo-50 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                            {['✨', '🎈', '🎁', '🎂', '🎊'][index % 5]}
                          </div>
                          <div>
                            <div className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{student.Name}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{student.Mobile}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-700">
                            {student.DOB}
                          </span>
                          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Birthday</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleWhatsAppShare(student.Name)}
                            disabled={isSharing !== null || isDownloading !== null}
                            className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm disabled:opacity-50 group/btn"
                            title="Share on WhatsApp"
                          >
                            {isSharing === student.Name ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <MessageCircle size={16} className="group-hover/btn:scale-110 transition-transform" />
                            )}
                          </button>
                          <button 
                            onClick={() => handleNativeShare(student.Name)}
                            className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm group/btn"
                            title="Share Message"
                          >
                            <Share2 size={16} className="group-hover/btn:scale-110 transition-transform" />
                          </button>
                          <button 
                            onClick={() => setSelectedStudent(student.Name)}
                            className="text-indigo-600 hover:text-white hover:bg-indigo-600 bg-indigo-50 px-4 py-3 rounded-xl font-black text-xs transition-all active:scale-95 shadow-sm"
                          >
                            Preview
                          </button>
                          <button 
                            onClick={() => handleDownload(student.Name)}
                            disabled={isDownloading !== null}
                            className="text-white bg-slate-900 hover:bg-slate-800 px-4 py-3 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-slate-200"
                          >
                            {isDownloading === student.Name ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Rendering...
                              </>
                            ) : (
                              <>
                                <Download size={14} />
                                Download
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-8 py-32 text-center">
                      <div className="text-8xl mb-6 animate-bounce">🍰</div>
                      <p className="text-2xl font-black text-slate-300">
                        {selectedDate 
                          ? `No birthdays on this date!`
                          : "No student data available."
                        }
                      </p>
                      <p className="text-slate-400 mt-2 font-medium">Check another date for more magic!</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden p-4 space-y-4">
            {isLoading ? (
              <div className="py-20 text-center text-slate-400">
                <Loader2 size={48} className="animate-spin text-indigo-500 mx-auto mb-4" />
                <p className="font-black uppercase tracking-widest text-xs">Preparing the party list...</p>
              </div>
            ) : filteredStudents.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {filteredStudents.map((student, index) => (
                  <motion.div 
                    key={index} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-3xl p-5 border border-slate-100 shadow-lg shadow-slate-200/20"
                  >
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-50 to-indigo-50 flex items-center justify-center text-2xl shadow-inner">
                        {['✨', '🎈', '🎁', '🎂', '🎊'][index % 5]}
                      </div>
                      <div className="flex-1">
                        <div className="text-lg font-black text-slate-900">{student.Name}</div>
                        <div className="flex items-center justify-between mt-0.5">
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{student.Mobile}</div>
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black border border-indigo-100">
                            {student.DOB}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleWhatsAppShare(student.Name)}
                        disabled={isSharing !== null || isDownloading !== null}
                        className="flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[10px] transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isSharing === student.Name ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <MessageCircle size={14} />
                        )}
                        {isSharing === student.Name ? 'Sharing...' : 'WhatsApp'}
                      </button>
                      <button 
                        onClick={() => handleNativeShare(student.Name)}
                        className="flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] transition-all active:scale-95"
                      >
                        <Share2 size={14} />
                        Share
                      </button>
                      <button 
                        onClick={() => setSelectedStudent(student.Name)}
                        className="flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] transition-all active:scale-95"
                      >
                        Preview
                      </button>
                      <button 
                        onClick={() => handleDownload(student.Name)}
                        disabled={isDownloading !== null}
                        className="flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-slate-200"
                      >
                        {isDownloading === student.Name ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        Download
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="text-6xl mb-4 animate-bounce">🍰</div>
                <p className="text-xl font-black text-slate-300">No birthdays today!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Share Modal */}
      {isSharing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 to-indigo-500" />
            
            <button 
              onClick={() => { setIsSharing(null); setShareFile(null); }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <MessageCircle size={40} className="text-emerald-500" />
              </div>
              
              <h3 className="text-2xl font-black text-slate-800 mb-2">Share with Video</h3>
              <p className="text-slate-500 font-medium mb-8">
                Preparing the birthday video for <span className="text-pink-600 font-bold">{isSharing}</span>...
              </p>

              {!shareFile && !shareError ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-16 h-16">
                    <Loader2 size={64} className="animate-spin text-indigo-500 absolute inset-0" />
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">🎬</div>
                  </div>
                  <p className="text-sm font-black text-indigo-600 animate-pulse">Rendering Video...</p>
                </div>
              ) : shareError ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700 text-xs font-medium text-left">
                    {shareError}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => {
                        const encodedMessage = encodeURIComponent(getBirthdayMessage(isSharing));
                        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
                      }}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={20} />
                      Share Message
                    </button>
                    <button 
                      onClick={() => handleDownload(isSharing)}
                      className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={20} />
                      Download Video
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-700 text-sm font-black flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    Video is Ready!
                  </div>
                  <button 
                    onClick={executeShare}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <MessageCircle size={20} />
                    Send to WhatsApp
                  </button>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Click the button up above to open WhatsApp with the video and message.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-pink-900/40 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-[3.5rem] max-w-sm w-full shadow-[0_32px_64px_-12px_rgba(219,39,119,0.3)] flex flex-col items-center relative border-4 border-pink-100">
            <button 
              onClick={() => setSelectedStudent(null)} 
              className="absolute -top-4 -right-4 bg-white text-pink-600 shadow-xl p-4 rounded-full hover:bg-pink-600 hover:text-white transition-all z-10 hover:rotate-90"
            >
              <X size={24} strokeWidth={3} />
            </button>
            
            <div className="w-full aspect-[9/16] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl ring-8 ring-pink-50">
              <Player
                component={BirthdayVideo}
                inputProps={{ studentName: selectedStudent }}
                durationInFrames={videoDuration}
                compositionWidth={1080}
                compositionHeight={1920}
                fps={30}
                style={{ width: '100%', height: '100%' }}
                controls
                autoPlay
                loop
              />
            </div>
            
            <div className="py-6 text-center w-full">
              <div className="inline-block px-4 py-1 bg-pink-50 text-pink-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                Birthday Preview
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-6">{selectedStudent}</h2>
              
              <button 
                onClick={() => setSelectedStudent(null)}
                className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-[1.5rem] font-black hover:shadow-lg hover:shadow-pink-200 transition-all active:scale-95"
              >
                <ArrowLeft size={20} strokeWidth={3} />
                Back to Party
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
