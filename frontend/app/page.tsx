"use client";
import { useState } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://muhammadnoraiz915-jobscout-ai-backend.hf.space";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [chatMsg, setChatMsg] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: string, text: string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const handleUpload = async (selectedFile: File) => {
    setLoading(true);
    setError("");
    setResults(null);
    setChatHistory([]);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await axios.post(`${API_URL}/api/upload-cv`, formData);
      setResults(res.data.data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Upload failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!chatMsg.trim() || !results) return;
    const userMsg = chatMsg;
    setChatMsg("");
    setChatHistory(prev => [...prev, {role: "user", text: userMsg}]);
    setChatLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/chat`, {
        message: userMsg,
        cv_info: results.cv_info,
        jobs: results.jobs
      });
      setChatHistory(prev => [...prev, {role: "ai", text: res.data.reply}]);
    } catch {
      setChatHistory(prev => [...prev, {role: "ai", text: "Kuch galat ho gaya, dobara try karo!"}]);
    } finally {
      setChatLoading(false);
    }
  };

  const filteredJobs = results?.jobs.filter((job: any) => {
    if (filter === "high") return job.score >= 70;
    if (filter === "mid") return job.score >= 40 && job.score < 70;
    if (filter === "low") return job.score < 40;
    return true;
  });

  return (
    <main style={{background:"#0f172a", minHeight:"100vh", color:"white", fontFamily:"sans-serif"}}>
      <div style={{maxWidth:"900px", margin:"0 auto", padding:"40px 20px"}}>
        
        {/* Header */}
        <div style={{textAlign:"center", marginBottom:"40px"}}>
          <div style={{display:"inline-flex", alignItems:"center", gap:"8px", background:"#1e293b", border:"1px solid #334155", borderRadius:"999px", padding:"6px 16px", marginBottom:"16px"}}>
            <div style={{width:"8px", height:"8px", borderRadius:"50%", background:"#22c55e"}}></div>
            <span style={{fontSize:"12px", color:"#94a3b8"}}>AI Agent Online</span>
          </div>
          <h1 style={{fontSize:"3.5rem", fontWeight:"bold", background:"linear-gradient(to right, #818cf8, #a78bfa, #67e8f9)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:"12px"}}>
            JobScout AI
          </h1>
          <p style={{color:"#94a3b8", fontSize:"1.1rem"}}>
            Your autonomous job hunting agent
          </p>
        </div>

        {/* Upload Zone */}
        {!results && !loading && (
          <label style={{display:"block", border:"2px dashed #4f46e5", borderRadius:"16px", padding:"60px 20px", textAlign:"center", cursor:"pointer", background:"#1e293b"}}>
            <div style={{fontSize:"3rem", marginBottom:"12px"}}>📄</div>
            <p style={{fontSize:"1.2rem", fontWeight:"bold", marginBottom:"8px"}}>
              {file ? file.name : "CV yahan drop karo ya click karo"}
            </p>
            <p style={{color:"#94a3b8", fontSize:"0.9rem"}}>PDF, DOC, DOCX</p>
            <input
              type="file"
              accept=".pdf,.docx,.doc"
              style={{display:"none"}}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); handleUpload(f); }
              }}
            />
          </label>
        )}

        {/* Loading */}
        {loading && (
          <div style={{background:"#1e293b", borderRadius:"16px", padding:"40px", textAlign:"center"}}>
            <div style={{fontSize:"2rem", marginBottom:"16px"}}>🤖</div>
            <p style={{fontSize:"1.2rem", color:"#818cf8", fontWeight:"bold"}}>AI kaam kar raha hai...</p>
            <div style={{marginTop:"24px", display:"flex", flexDirection:"column", gap:"12px"}}>
              {["CV parse ho rahi hai...", "Skills extract ho rahi hain...", "Jobs search ho rahi hain...", "Jobs score ho rahi hain..."].map((s, i) => (
                <div key={i} style={{background:"#0f172a", borderRadius:"8px", padding:"10px 16px", color:"#94a3b8", fontSize:"0.9rem"}}>
                  ⏳ {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p style={{color:"#f87171", textAlign:"center", marginTop:"16px"}}>{error}</p>}

        {/* Results */}
        {results && (
          <div>
            {/* CV Card */}
            <div style={{background:"#1e293b", borderRadius:"16px", padding:"24px", marginBottom:"24px", border:"1px solid #334155"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"start", flexWrap:"wrap", gap:"12px"}}>
                <div style={{display:"flex", alignItems:"center", gap:"16px"}}>
                  <div style={{width:"56px", height:"56px", borderRadius:"12px", background:"linear-gradient(135deg, #4f46e5, #7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.5rem", fontWeight:"bold"}}>
                    {results.cv_info?.name?.charAt(0) || "U"}
                  </div>
                  <div>
                    <h2 style={{fontSize:"1.3rem", fontWeight:"bold"}}>{results.cv_info?.name}</h2>
                    <p style={{color:"#94a3b8", fontSize:"0.85rem"}}>{results.cv_info?.experience_years} years • {results.cv_info?.education}</p>
                  </div>
                </div>
                <button onClick={() => {setResults(null); setFile(null); setChatHistory([]);}}
                  style={{background:"#334155", border:"none", color:"white", padding:"8px 16px", borderRadius:"8px", cursor:"pointer"}}>
                  Naya CV
                </button>
              </div>
              <div style={{marginTop:"16px", display:"flex", flexWrap:"wrap", gap:"8px"}}>
                {results.cv_info?.skills?.slice(0, 8).map((skill: string, i: number) => {
                  const colors = ["#4f46e5","#7c3aed","#0891b2","#059669","#db2777"];
                  return (
                    <span key={i} style={{background:colors[i%colors.length]+"20", color:colors[i%colors.length], border:"1px solid "+colors[i%colors.length]+"40", padding:"4px 12px", borderRadius:"999px", fontSize:"0.8rem"}}>
                      {skill}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Filters */}
            <div style={{display:"flex", gap:"8px", marginBottom:"20px", flexWrap:"wrap"}}>
              <span style={{color:"#94a3b8", alignSelf:"center"}}>{results.total_jobs} jobs:</span>
              {[{k:"all",l:"Sab"},{k:"high",l:"Strong 70%+"},{k:"mid",l:"Medium"},{k:"low",l:"Weak"}].map(f => (
                <button key={f.k} onClick={() => setFilter(f.k)}
                  style={{padding:"8px 16px", borderRadius:"8px", border:"none", cursor:"pointer", fontWeight:"500",
                    background: filter===f.k ? "#4f46e5" : "#1e293b",
                    color: filter===f.k ? "white" : "#94a3b8"}}>
                  {f.l}
                </button>
              ))}
            </div>

            {/* Job Cards */}
            <div style={{display:"flex", flexDirection:"column", gap:"16px", marginBottom:"32px"}}>
              {filteredJobs?.map((job: any, i: number) => (
                <div key={i} style={{
                  background:"#1e293b", borderRadius:"16px", padding:"24px",
                  borderLeft: `4px solid ${job.score>=70?"#22c55e":job.score>=40?"#f59e0b":"#ef4444"}`
                }}>
                  {/* Card header: title + score + Apply Now */}
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"start", gap:"12px", flexWrap:"wrap"}}>
                    <div style={{flex:1, minWidth:0}}>
                      <p style={{color:"white", fontWeight:"bold", fontSize:"1.1rem", margin:0, lineHeight:"1.4"}}>
                        {job.title}
                      </p>
                      <p style={{color:"#64748b", fontSize:"0.85rem", marginTop:"4px", marginBottom:0}}>via {job.source}</p>
                    </div>
                    <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"8px", flexShrink:0}}>
                      <span style={{fontSize:"2rem", fontWeight:"bold", color:job.score>=70?"#22c55e":job.score>=40?"#f59e0b":"#ef4444", lineHeight:1}}>
                        {job.score}%
                      </span>
                      <a
                        href={job.url || `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(job.title)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display:"inline-block",
                          background: job.score>=70 ? "#22c55e" : job.score>=40 ? "#f59e0b" : "#4f46e5",
                          color:"white",
                          fontWeight:"700",
                          fontSize:"0.85rem",
                          padding:"8px 18px",
                          borderRadius:"8px",
                          textDecoration:"none",
                          whiteSpace:"nowrap",
                        }}
                      >
                        Apply Now →
                      </a>
                    </div>
                  </div>
                  <div style={{background:"#0f172a", borderRadius:"8px", padding:"12px", marginTop:"12px"}}>
                    <p style={{color:"#94a3b8", fontSize:"0.8rem", marginBottom:"4px", fontWeight:"bold"}}>🤖 AI Reasoning:</p>
                    <p style={{color:"#cbd5e1", fontSize:"0.9rem"}}>{job.reasoning}</p>
                  </div>
                  {job.missing_skills?.length > 0 && (
                    <div style={{marginTop:"12px", display:"flex", flexWrap:"wrap", gap:"6px"}}>
                      <span style={{color:"#64748b", fontSize:"0.8rem", alignSelf:"center"}}>Missing:</span>
                      {job.missing_skills.map((s: string, j: number) => (
                        <span key={j} style={{background:"#ef444420", color:"#f87171", border:"1px solid #ef444440", padding:"2px 10px", borderRadius:"999px", fontSize:"0.75rem"}}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {!job.url && (
                    <p style={{color:"#475569", fontSize:"0.75rem", marginTop:"8px", marginBottom:0}}>
                      Direct link unavailable — button searches {job.source || "LinkedIn"} by title
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Chat Section */}
            <div style={{background:"#1e293b", borderRadius:"16px", padding:"24px", border:"1px solid #4f46e5"}}>
              <h3 style={{fontSize:"1.1rem", fontWeight:"bold", marginBottom:"16px"}}>
                🤖 Career Advisor — Kuch bhi poochho!
              </h3>
              <div style={{background:"#0f172a", borderRadius:"12px", padding:"16px", minHeight:"200px", maxHeight:"300px", overflowY:"auto", marginBottom:"16px", display:"flex", flexDirection:"column", gap:"12px"}}>
                {chatHistory.length === 0 && (
                  <div style={{color:"#475569", textAlign:"center", marginTop:"60px", fontSize:"0.9rem"}}>
                    Poochho: "Meri CV improve kaise karoon?" ya "Kaunsi skills seekhni chahiye?"
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} style={{display:"flex", justifyContent: msg.role==="user"?"flex-end":"flex-start"}}>
                    <div style={{
                      maxWidth:"80%", padding:"10px 16px", borderRadius:"12px", fontSize:"0.9rem",
                      background: msg.role==="user" ? "#4f46e5" : "#1e293b",
                      border: msg.role==="ai" ? "1px solid #334155" : "none",
                      color: "white"
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{color:"#818cf8", fontSize:"0.9rem"}}>AI soch raha hai... 🤔</div>
                )}
              </div>
              <div style={{display:"flex", gap:"8px"}}>
                <input
                  value={chatMsg}
                  onChange={(e) => setChatMsg(e.target.value)}
                  onKeyDown={(e) => e.key==="Enter" && handleChat()}
                  placeholder="Apna sawal likho..."
                  style={{flex:1, background:"#0f172a", border:"1px solid #334155", borderRadius:"8px", padding:"12px 16px", color:"white", fontSize:"0.9rem", outline:"none"}}
                />
                <button onClick={handleChat} disabled={chatLoading}
                  style={{background:"#4f46e5", border:"none", color:"white", padding:"12px 20px", borderRadius:"8px", cursor:"pointer", fontSize:"1rem"}}>
                  ➤
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}