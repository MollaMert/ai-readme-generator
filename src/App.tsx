import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Copy, Download, Code2, Type, Layout, Terminal, Github, Folder, Globe, FileJson, Settings, Key, Cpu } from 'lucide-react';

function App() {
  const [formData, setFormData] = useState({
    projectName: '',
    description: '',
    techStack: '',
    tone: 'Professional',
    sourceType: 'manual', // 'manual', 'github', 'local'
    githubUrl: '',
    aiProvider: 'gemini', // 'gemini', 'openai', 'anthropic', 'custom'
    apiKey: '',
    customEndpoint: 'https://api.openai.com/v1/chat/completions',
    customModel: 'gpt-4o-mini',
  });
  
  const [localFiles, setLocalFiles] = useState<FileList | null>(null);
  const [generatedMarkdown, setGeneratedMarkdown] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSourceTypeClick = (type: string) => {
    setFormData(prev => ({ ...prev, sourceType: type }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setLocalFiles(e.target.files);
    }
  };

  const fetchGithubContext = async (url: string) => {
    try {
      const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
      const match = url.match(regex);
      if(!match) throw new Error("Invalid GitHub URL.");
      const owner = match[1];
      const repo = match[2].replace('.git', '');

      setLoadingStatus('Fetching GitHub Tree...');
      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
      if(!treeRes.ok) throw new Error("Could not reach GitHub repository. Make sure it is public.");
      const treeData = await treeRes.json();
      
      const paths = treeData.tree
        .map((t: any) => t.path)
        .filter((p: string) => !p.includes('node_modules') && !p.includes('.git') && !p.includes('.next'))
        .slice(0, 150);

      let packageJsonContent = "";
      const pkgPath = treeData.tree.find((t: any) => t.path === 'package.json');
      if (pkgPath) {
         setLoadingStatus('Fetching package.json...');
         const pkgRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/package.json`);
         if(pkgRes.ok) {
           packageJsonContent = await pkgRes.text();
         }
      }

      return `\nGitHub Project File Tree (Summary):\n${paths.join('\n')}\n` + 
             (packageJsonContent ? `\npackage.json Content:\n${packageJsonContent}\n` : "");
    } catch(err: any) {
      throw new Error("GitHub Fetch Error: " + err.message);
    }
  };

  const getLocalFilesContext = async (files: FileList) => {
    setLoadingStatus('Analyzing Folder Structure...');
    const paths = Array.from(files)
      .map(f => f.webkitRelativePath || f.name)
      .filter(p => !p.includes('node_modules') && !p.includes('.git') && !p.includes('.next'))
      .slice(0, 150);

    let packageJsonContent = "";
    const pkgFile = Array.from(files).find(f => (f.webkitRelativePath || f.name).endsWith('package.json'));
    
    if (pkgFile) {
      setLoadingStatus('Reading package.json...');
      packageJsonContent = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsText(pkgFile);
      });
    }

    return `\nLocal Folder File Tree (Summary):\n${paths.join('\n')}\n` + 
           (packageJsonContent ? `\npackage.json Content:\n${packageJsonContent}\n` : "");
  };

  const callAIProvider = async (prompt: string): Promise<string> => {
    let endpoint = "";
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: any = {};

    setLoadingStatus('AI is writing your README...');

    if (formData.aiProvider === 'gemini') {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${formData.customModel || 'gemini-2.5-flash'}:generateContent?key=${formData.apiKey}`;
      body = { contents: [{ parts: [{ text: prompt }] }] };
      
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Gemini API Error');
      return data.candidates[0].content.parts[0].text;

    } else if (formData.aiProvider === 'openai') {
      endpoint = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${formData.apiKey}`;
      body = {
        model: formData.customModel || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }]
      };
      
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'OpenAI API Error');
      return data.choices[0].message.content;

    } else if (formData.aiProvider === 'anthropic') {
      // Note: Anthropic REST API from browser often causes CORS issues unless using a proxy.
      endpoint = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = formData.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true'; // Often needed for browser calls
      body = {
        model: formData.customModel || 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      };
      
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Anthropic API Error (CORS issues may apply)');
      return data.content[0].text;

    } else if (formData.aiProvider === 'custom') {
      endpoint = formData.customEndpoint;
      if (formData.apiKey) headers['Authorization'] = `Bearer ${formData.apiKey}`;
      body = {
        model: formData.customModel,
        messages: [{ role: 'user', content: prompt }]
      };
      
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(`Custom API Error: ${res.statusText}`);
      // Try to parse standard OpenAI-compatible response or fallback
      return data.choices?.[0]?.message?.content || data.message || JSON.stringify(data);
    }
    
    throw new Error('Invalid AI Provider selected');
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoadingStatus('Initializing Settings...');

    try {
      if (!formData.apiKey && formData.aiProvider !== 'custom') {
        throw new Error("Please enter an API Key for the selected provider.");
      }

      let extraContext = "";

      if (formData.sourceType === 'github' && formData.githubUrl) {
        extraContext = await fetchGithubContext(formData.githubUrl);
      } else if (formData.sourceType === 'local' && localFiles) {
        extraContext = await getLocalFilesContext(localFiles);
      }

      const prompt = `You are an expert, professional software documentation writer. 
Using the project details and any extra file tree/configuration context below, create an awesome, elegantly formatted README.md file for GitHub, enriched with standard emojis. 
The tone of the generated README should be: "${formData.tone}".

Project Name: ${formData.projectName}
Description: ${formData.description}
${formData.techStack ? `Tech Stack: ${formData.techStack}` : ''}
${extraContext ? `\n\n--- EXTRA PROJECT CONTEXT ---\nThe information below contains the project's file tree or package.json/config details. Use this to accurately deduce installation steps, usage, and features to include in the README. Represent the folder structure using a standard ASCII text tree:\n${extraContext}\n-----------------------------` : ''}

Only output the raw Markdown content for the README. Do not add any conversational text before or after the markdown syntax block. Ensure the markdown output is flawless, detailed, and visually appealing.`;

      let text = await callAIProvider(prompt);
      
      // Clean up markdown wrapper if model added it
      if (text.startsWith('\`\`\`markdown')) {
        text = text.replace(/^\`\`\`markdown\n?/, "").replace(/\n?\`\`\`$/, "");
      } else if (text.startsWith('\`\`\`')) {
        text = text.replace(/^\`\`\`\n?/, "").replace(/\n?\`\`\`$/, "");
      }
      
      setGeneratedMarkdown(text.trim());
    } catch (error: Omit<any, never>) {
       const err = error as Error;
       alert("Error: " + err.message);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedMarkdown);
    alert('Copied to clipboard!');
  };

  const downloadMarkdown = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedMarkdown], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = 'README.md';
    document.body.appendChild(element); // Required for FireFox
    element.click();
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      
      {/* Header */}
      <header className="mb-8 text-center max-w-2xl">
        <h1 className="text-4xl md:text-5xl border-none font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center justify-center gap-3">
          <Sparkles className="text-blue-400 w-10 h-10" />
          AI README Generator
        </h1>
        <p className="mt-4 text-slate-400 text-lg">
          Generate a professional, eye-catching README.md for your open-source project in seconds.
        </p>
      </header>

      {/* Main Grid */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col lg:col-span-5 relative z-10">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-100 border-none">
            <Layout className="w-6 h-6 text-blue-400" />
            Project Details
          </h2>
          
          <form onSubmit={handleGenerate} className="flex flex-col gap-5 flex-grow">
            
            {/* API Settings Block */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
              <label className="block text-sm font-semibold text-indigo-300 mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Provider Settings (BYOK)
              </label>
              
              <div className="grid grid-cols-2 gap-2 mb-3">
                <select 
                  name="aiProvider"
                  value={formData.aiProvider}
                  onChange={handleInputChange}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-slate-100 focus:ring-1 focus:ring-indigo-500 appearance-none"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="custom">Custom (OpenRouter/Local)</option>
                </select>
                
                <input 
                  type="text" 
                  name="customModel"
                  value={formData.customModel}
                  onChange={handleInputChange}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder={
                    formData.aiProvider === 'gemini' ? "gemini-2.5-flash" :
                    formData.aiProvider === 'openai' ? "gpt-4o-mini" :
                    formData.aiProvider === 'anthropic' ? "claude-3-5-sonnet-20241022" : "Model API Name"
                  }
                />
              </div>

              {formData.aiProvider === 'custom' && (
                <div className="mb-3">
                  <input 
                    type="url" 
                    name="customEndpoint"
                    value={formData.customEndpoint}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="https://openrouter.ai/api/v1/chat/completions"
                  />
                </div>
              )}

              <div className="flex relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-4 w-4 text-slate-400" />
                </div>
                <input 
                  type="password" 
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={handleInputChange}
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-emerald-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono tracking-wider"
                  placeholder="Paste your API Key here safely"
                  required={formData.aiProvider !== 'custom'}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 text-center">Keys are stored only in your browser memory and sent directly to the exact provider.</p>
            </div>

            {/* Context Source Block */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
              <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                 <Cpu className="w-4 h-4 text-emerald-400" /> Context Source (Highly Recommended)
              </label>
              
              <div className="flex bg-slate-900 rounded-lg p-1.5 mb-4 gap-1">
                <button type="button" onClick={() => handleSourceTypeClick('manual')} className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${formData.sourceType === 'manual' ? 'bg-blue-600/30 text-blue-400 border border-blue-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                  <Globe className="w-3 h-3" /> Manual
                </button>
                <button type="button" onClick={() => handleSourceTypeClick('github')} className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${formData.sourceType === 'github' ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                  <Github className="w-3 h-3" /> GitHub
                </button>
                <button type="button" onClick={() => handleSourceTypeClick('local')} className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${formData.sourceType === 'local' ? 'bg-purple-600/30 text-purple-400 border border-purple-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                  <Folder className="w-3 h-3" /> Folder
                </button>
              </div>

              {formData.sourceType === 'github' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <input 
                    type="url" 
                    name="githubUrl"
                    value={formData.githubUrl}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900/80 border border-emerald-500/40 focus:border-emerald-400 rounded-lg p-2.5 text-emerald-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all text-sm mb-2"
                    placeholder="https://github.com/facebook/react"
                  />
                  <p className="text-xs text-slate-400 leading-tight">We fetch the file tree of public repos to formulate accurate installation/usage steps.</p>
                </div>
              )}

              {formData.sourceType === 'local' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="flex items-center justify-center w-full h-14 border-2 border-dashed border-purple-500/40 focus-within:border-purple-400 rounded-lg cursor-pointer bg-slate-900/80 hover:bg-slate-800/80 transition-all">
                    <span className="text-purple-300 text-sm font-medium flex items-center gap-2">
                       <Folder className="w-5 h-5" />
                       {localFiles ? `${localFiles.length} files selected` : 'Select Project Folder'}
                    </span>
                    <input 
                      type="file" 
                      onChange={handleFileChange}
                      /* @ts-expect-error webkitdirectory is supported by most modern browsers */
                      webkitdirectory="true"
                      directory="true"
                      multiple
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-400 mt-2 text-center">Files are NOT uploaded! We only read folder hierarchy locally.</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" /> Project Name <span className="text-red-400">*</span>
              </label>
              <input 
                type="text" 
                name="projectName"
                value={formData.projectName}
                onChange={handleInputChange}
                required
                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="e.g. SuperTasker CLI"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                <Type className="w-4 h-4 text-blue-400" /> Description <span className="text-red-400">*</span>
              </label>
              <textarea 
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={3}
                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                placeholder="What does this project do? What problem does it solve?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-blue-400" /> Tech Stack (Optional)
              </label>
              <input 
                type="text" 
                name="techStack"
                value={formData.techStack}
                onChange={handleInputChange}
                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="e.g. React, Node.js, Tailwind (if no source provided)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">README Tone</label>
              <select 
                name="tone"
                value={formData.tone}
                onChange={handleInputChange}
                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
              >
                <option value="Professional">Professional & Serious</option>
                <option value="Friendly">Friendly & Emoji Driven</option>
                <option value="Minimalist">Clean & Minimalist</option>
                <option value="Pirate">Pirate Speak (Fun)</option>
              </select>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="mt-4 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-semibold">{loadingStatus || 'Processing...'}</span>
                  </div>
                </div>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Advanced README
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Preview */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col lg:col-span-7 h-[110vh] max-h-[900px] overflow-hidden relative z-10">
          <div className="flex items-center justify-between mb-4 border-b border-slate-700/60 pb-4">
            <h2 className="text-xl font-bold text-slate-100 border-none m-0 p-0 flex items-center gap-2">
               <FileJson className="w-5 h-5 text-indigo-400" /> MD Preview
            </h2>
            {generatedMarkdown && (
              <div className="flex gap-2">
                <button 
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 text-slate-300 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                  title="Copy"
                >
                  <Copy className="w-4 h-4" /> Copy
                </button>
                <button 
                  onClick={downloadMarkdown}
                  className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                  title="Download"
                >
                  <Download className="w-4 h-4" /> Download
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar markdown-preview relative">
             {isLoading && (
               <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-20 rounded-lg">
                 <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl flex flex-col items-center text-center max-w-sm">
                    <Sparkles className="w-10 h-10 text-indigo-400 mb-4 animate-pulse" />
                    <p className="text-lg font-bold text-white mb-2">{loadingStatus}</p>
                    <p className="text-sm text-slate-400">AI is analyzing your stack and crafting the perfect Markdown document. Please wait a moment...</p>
                 </div>
               </div>
             )}
             
            {generatedMarkdown ? (
              <div className="text-slate-200">
                <ReactMarkdown>{generatedMarkdown}</ReactMarkdown>
              </div>
            ) : (
              !isLoading && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-6 opacity-60">
                  <div className="relative">
                    <Code2 className="w-20 h-20 text-slate-600" />
                    <Sparkles className="w-8 h-8 text-blue-500 absolute -top-2 -right-2 opacity-50" />
                  </div>
                  <div className="text-center max-w-sm">
                    <h3 className="text-lg font-semibold text-slate-400 mb-2">Live Preview Area</h3>
                    <p className="text-sm">You haven't generated a README yet. Fill the mandatory fields on the left, optionally paste an API key securely, and let the magic happen.</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
