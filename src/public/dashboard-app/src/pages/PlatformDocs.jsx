import React from 'react';

function PlatformDocs() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Platform Documentation</h1>
        <p className="text-slate-400 text-lg">
          Learn how to use each feature and category within the MyApi platform.
        </p>
      </div>

      <div className="grid gap-6">
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-blue-400 mb-3 flex items-center gap-2">
            <span>🔗</span> Services
          </h2>
          <p className="text-slate-300 leading-relaxed">
            The Services section allows you to connect MyApi to external platforms like Google, GitHub, Slack, and Discord using OAuth. Once connected, your AI personas and agents can act on your behalf across these platforms without needing you to manually copy-paste API keys.
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-indigo-400 mb-3 flex items-center gap-2">
            <span>🗝️</span> Token Vault
          </h2>
          <p className="text-slate-300 leading-relaxed">
            The Token Vault is where you securely store static API keys and credentials (like your OpenAI key, Anthropic key, or custom service tokens). MyApi encrypts these at rest. You can also use the auto-discovery tool here to automatically figure out a service's API endpoint from its website URL.
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-violet-400 mb-3 flex items-center gap-2">
            <span>🎟️</span> Access Tokens
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Here you generate Guest Tokens that give external AI agents (like ChatGPT, Claude, or custom scripts) permission to access your MyApi instance. You can limit these tokens to specific "Scopes" (e.g., read-only, or only allowed to talk to specific Personas) so you stay in control of your data.
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-fuchsia-400 mb-3 flex items-center gap-2">
            <span>🎭</span> Personas
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Personas represent different AI personalities or roles (like "Senior Developer" or "Marketing Assistant"). For each persona, you can define specific rules, system prompts, and attach customized Knowledge Base documents and Skills to specialize their capabilities.
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-emerald-400 mb-3 flex items-center gap-2">
            <span>🧩</span> Skills
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Skills are code snippets or actions your AI can take. You can write custom skills, define configuration JSON, and attach them directly to Personas. Skills expand what your AI is fundamentally able to do (like fetching live weather or running a deployment).
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-cyan-400 mb-3 flex items-center gap-2">
            <span>📚</span> Knowledge Base
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Upload text files, markdown, or PDFs to give your AI context. These documents form the long-term memory of your AI. You can attach specific documents to specific Personas so they only retrieve the information relevant to their role.
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-pink-400 mb-3 flex items-center gap-2">
            <span>🛒</span> Marketplace
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Browse community-created Personas, Skills, and Connectors. You can install them directly into your instance with one click. The marketplace includes a security scanner that evaluates community skills for potentially dangerous code before you install them.
          </p>
        </section>
        
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-blue-500 mb-3 flex items-center gap-2">
            <span>👤</span> Identity
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Your global user profile. This information is passed to all Personas as base context so the AI always knows who it is talking to, regardless of which Persona is currently active.
          </p>
        </section>
      </div>
    </div>
  );
}

export default PlatformDocs;
