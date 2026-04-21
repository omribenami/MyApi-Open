import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { completeOnboarding, dismissModal } from '../utils/onboardingUtils';

// ─── Icons ───────────────────────────────────────────────────────────────────

function Icon({ name, size = 16, strokeWidth = 1.75, style, className }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const props = { width: size, height: size, viewBox: '0 0 24 24', style, className };
  switch (name) {
    case 'check': return <svg {...props} {...s}><polyline points="20 6 9 17 4 12" /></svg>;
    case 'arrowRight': return <svg {...props} {...s}><path d="M5 12h14M13 5l7 7-7 7" /></svg>;
    case 'arrowLeft': return <svg {...props} {...s}><path d="M19 12H5M12 5l-7 7 7 7" /></svg>;
    case 'close': return <svg {...props} {...s}><path d="M18 6 6 18M6 6l12 12" /></svg>;
    case 'shield': return <svg {...props} {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case 'shieldCheck': return <svg {...props} {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>;
    case 'key': return <svg {...props} {...s}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>;
    case 'lock': return <svg {...props} {...s}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
    case 'tip': return <svg {...props} {...s}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.5 1 2.3v.5h6V17c0-.8.3-1.7 1-2.3A7 7 0 0 0 12 2z" /></svg>;
    case 'copy': return <svg {...props} {...s}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
    case 'eye': return <svg {...props} {...s}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>;
    case 'eyeOff': return <svg {...props} {...s}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="2" y1="2" x2="22" y2="22" /></svg>;
    case 'sparkles': return <svg {...props} {...s}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" /><path d="M5 3v4M19 17v4M3 5h4M17 19h4" /></svg>;
    case 'book': return <svg {...props} {...s}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>;
    case 'bolt': return <svg {...props} {...s}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
    case 'terminal': return <svg {...props} {...s}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>;
    case 'brain': return <svg {...props} {...s}><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /></svg>;
    case 'chevron': return <svg {...props} {...s}><polyline points="9 18 15 12 9 6" /></svg>;
    case 'user': return <svg {...props} {...s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case 'checkCircle': return <svg {...props} {...s}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>;
    case 'alertTriangle': return <svg {...props} {...s}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    default: return null;
  }
}

// ─── Service SVGs ─────────────────────────────────────────────────────────────

const SvcIcon = {
  github: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" /></svg>,
  google: <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
  slack: <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.521-10.123a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" /></svg>,
  discord: <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.51.07.07 0 0 0-.08.04c-.21.37-.44.86-.6 1.25a18.27 18.27 0 0 0-5.5 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04A19.74 19.74 0 0 0 3.68 4.37a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06c0 .02.01.04.03.06a19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13 10.2 10.2 0 0 0 .37-.29.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01c.12.1.25.2.37.3a.08.08 0 0 1-.01.12 12.3 12.3 0 0 1-1.87.9.08.08 0 0 0-.04.1c.36.7.77 1.37 1.22 2a.08.08 0 0 0 .09.03 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.17-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03z" /></svg>,
  notion: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4.46 4.21c.74.6 1.02.56 2.42.47l13.21-.8c.28 0 .05-.27-.04-.32L17.86 2c-.42-.33-.98-.7-2.06-.61L3.01 2.3c-.47.04-.56.28-.37.46zm.79 3.08v13.9c0 .75.37 1.03 1.22.99l14.52-.84c.84-.05.94-.56.94-1.17V6.35c0-.6-.23-.93-.75-.88l-15.18.88c-.56.05-.75.33-.75.93zm14.34.75c.09.42 0 .84-.42.88l-.7.14v10.26c-.6.33-1.17.51-1.63.51-.75 0-.94-.23-1.5-.93l-4.57-7.18v6.95l1.45.33s0 .84-1.17.84l-3.22.19c-.1-.19 0-.65.32-.75l.84-.23V9.85l-1.17-.1c-.09-.42.14-1.02.8-1.07l3.45-.23 4.77 7.28V9.29l-1.22-.14c-.09-.51.28-.88.75-.93zM1.94 1.04 15.24.05c1.64-.14 2.06-.05 3.08.7l4.25 2.99c.7.51.94.66.94 1.22v16.38c0 1.03-.37 1.63-1.68 1.73l-15.46.93c-.98.05-1.45-.1-1.97-.75l-3.13-4.06c-.56-.75-.79-1.3-.79-1.96V2.67c0-.84.37-1.54 1.44-1.63z" /></svg>,
  linear: <svg width="20" height="20" viewBox="0 0 100 100" fill="#5E6AD2"><path d="M1.23 61.52c-.22-.95.91-1.55 1.6-.86L37.99 95.93c.69.69.09 1.82-.86 1.6C20.05 94.05 5.95 79.95 1.23 61.52zM.002 46.89a.84.84 0 0 0 .29.76L52.35 99.71a.84.84 0 0 0 .76.29c2.36-.14 4.64-.44 6.92-.9.35-.07.6-.4.6-.75v-.3c0-.29-.12-.57-.33-.77L3.08 39.97a.84.84 0 0 0-.77-.33.77.77 0 0 0-.75.6c-.46 2.29-.75 4.52-.9 6.92zM4.58 32.45c-.15.36.04.76.39.88L66.76 95.04c.35.13.53.53.39.88-4.66-1.94-8.98-4.71-12.76-8.49a.63.63 0 0 1 .01-.92l.01.01L6.97 35.45a.65.65 0 0 0-.92-.01c-3.77 3.78-6.54 8.1-8.48 12.76z" /></svg>,
  twitter: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  linkedin: <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  instagram: <svg width="20" height="20" viewBox="0 0 24 24"><defs><radialGradient id="ig-grad" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/><stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/><stop offset="90%" stopColor="#285AEB"/></radialGradient></defs><path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>,
  facebook: <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  reddit: <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>,
  whatsapp: <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>,
  tiktok: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg>,
};

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ob-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4A8CFF" />
          <stop offset="100%" stopColor="#6058FF" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#ob-logo-grad)" />
      <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Shared Primitives ────────────────────────────────────────────────────────

function FieldLabel({ children, required, optional, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
      <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
        {children} {required && <span style={{ color: 'var(--accent)' }}>*</span>}
        {optional && <span style={{ color: 'var(--ink-4)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit', fontSize: 11 }}> — optional</span>}
      </label>
      {hint && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{hint}</span>}
    </div>
  );
}

function TipCard({ title, body, variant = 'info' }) {
  const color = variant === 'security' ? 'var(--green)' : variant === 'warn' ? 'var(--amber)' : 'var(--accent)';
  const bg = variant === 'security' ? 'var(--green-bg)' : variant === 'warn' ? 'var(--amber-bg)' : 'var(--accent-bg)';
  return (
    <div style={{ borderRadius: 6, background: bg, border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, padding: '10px 14px', display: 'flex', gap: 10 }}>
      <div style={{ color, flexShrink: 0, marginTop: 1 }}>
        <Icon name={variant === 'security' ? 'shield' : 'tip'} size={14} />
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color, margin: '0 0 2px' }}>{title}</p>
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>{body}</p>
      </div>
    </div>
  );
}

function Chip({ selected, onClick, children, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
      background: selected ? 'var(--accent-bg)' : 'var(--bg-sunk)',
      border: `1px solid ${selected ? 'var(--accent-2)' : 'var(--line)'}`,
      color: selected ? 'var(--accent)' : 'var(--ink-2)',
      opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
    }}>{children}</button>
  );
}

function RadioCard({ selected, onClick, title, desc, icon, badge }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14,
      borderRadius: 8, textAlign: 'left', width: '100%', cursor: 'pointer',
      background: selected ? 'var(--accent-bg)' : 'var(--bg-sunk)',
      border: `1px solid ${selected ? 'var(--accent-2)' : 'var(--line)'}`,
      transition: 'all 0.15s',
    }}>
      {icon && (
        <span style={{
          width: 34, height: 34, borderRadius: 8, background: selected ? 'var(--bg-raised)' : 'var(--bg)',
          border: '1px solid var(--line)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: selected ? 'var(--accent)' : 'var(--ink-2)', flexShrink: 0,
        }}>{icon}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
              background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>{badge.text}</span>
          )}
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
      </div>
      <span style={{
        width: 18, height: 18, borderRadius: 999, flexShrink: 0, marginTop: 8,
        border: `2px solid ${selected ? 'var(--accent)' : 'var(--line)'}`,
        background: selected ? 'var(--accent)' : 'transparent',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      }}>
        {selected && <Icon name="check" size={10} strokeWidth={4} />}
      </span>
    </button>
  );
}

function StepChip({ index, current, label, onClick }) {
  const active = index === current;
  const complete = index < current;
  return (
    <button onClick={onClick} disabled={!complete && !active} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      borderRadius: 8, border: `1px solid ${active ? 'var(--accent-2)' : 'transparent'}`,
      background: active ? 'var(--accent-bg)' : 'transparent',
      color: active ? 'var(--ink)' : complete ? 'var(--ink-2)' : 'var(--ink-4)',
      cursor: (complete || active) ? 'pointer' : 'not-allowed',
      textAlign: 'left', width: '100%', fontSize: 13, transition: 'all 0.15s',
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
        background: complete ? 'var(--accent)' : active ? 'var(--bg-raised)' : 'var(--bg-sunk)',
        color: complete ? '#fff' : active ? 'var(--accent)' : 'var(--ink-4)',
        border: `1px solid ${complete ? 'var(--accent)' : active ? 'var(--accent-2)' : 'var(--line)'}`,
      }}>
        {complete ? <Icon name="check" size={12} strokeWidth={3} /> : index + 1}
      </span>
      <span style={{ fontWeight: active ? 600 : 500 }}>{label}</span>
    </button>
  );
}

function MobileProgress({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 999,
          background: i <= current ? 'var(--accent)' : 'var(--line)',
          opacity: i <= current ? 1 : 0.5,
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function StepProfile({ data, update }) {
  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Who are you?</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
          Stored in your <code style={{ fontSize: 12.5, color: 'var(--ink)', background: 'var(--bg-sunk)', padding: '1px 6px', borderRadius: 4 }}>USER.md</code> file — agents fetch it on demand when they need context about you before responding.
        </p>
      </div>

      <div>
        <FieldLabel required>Display name</FieldLabel>
        <input type="text" placeholder="How should agents address you?" autoFocus
          value={data.name || ''} onChange={e => update({ name: e.target.value })}
          style={{ fontSize: 14, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', color: 'var(--ink)', outline: 'none', width: '100%', fontFamily: 'inherit' }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-bg)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none'; }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <FieldLabel optional>Role</FieldLabel>
          <input type="text" placeholder="Software Engineer"
            value={data.role || ''} onChange={e => update({ role: e.target.value })}
            style={{ fontSize: 14, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', color: 'var(--ink)', outline: 'none', width: '100%', fontFamily: 'inherit' }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-bg)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
        <div>
          <FieldLabel optional>Timezone</FieldLabel>
          <select value={data.tz || 'auto'} onChange={e => update({ tz: e.target.value })}
            style={{ fontSize: 14, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', color: 'var(--ink)', outline: 'none', width: '100%', fontFamily: 'inherit' }}>
            <option value="auto">Auto-detect</option>
            <option value="UTC">UTC</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
          </select>
        </div>
      </div>

      <div>
        <FieldLabel optional hint={`${(data.bio || '').length}/280`}>About you</FieldLabel>
        <textarea rows={3} maxLength={280}
          placeholder="A few sentences — your tools, how you work, what you're building."
          value={data.bio || ''} onChange={e => update({ bio: e.target.value })}
          style={{ fontSize: 14, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', color: 'var(--ink)', outline: 'none', width: '100%', fontFamily: 'inherit', resize: 'none', lineHeight: 1.6 }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-bg)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none'; }}
        />
      </div>

      <TipCard
        title="Skip if your agent can write this for you"
        body="You don't have to fill this in by hand — finish setup, then ask your agent to generate USER.md and upload it from the Identity page."
      />
    </div>
  );
}

const TRAITS = ['Decisive', 'Analytical', 'Creative', 'Pragmatic', 'Detail-oriented', 'Big-picture', 'Async-friendly', 'Research-heavy'];
const STYLES = [
  { id: 'direct', title: 'Direct & concise', desc: 'Short answers. Skip preamble.' },
  { id: 'detailed', title: 'Detailed & thorough', desc: 'Explain reasoning, show examples.' },
  { id: 'casual', title: 'Casual & collaborative', desc: 'Conversational, thinks out loud.' },
];

function StepPersona({ data, update }) {
  const toggleTrait = (t) => {
    const cur = data.traits || [];
    if (cur.includes(t)) update({ traits: cur.filter(x => x !== t) });
    else if (cur.length < 3) update({ traits: [...cur, t] });
  };
  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Shape your first persona</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
          We'll create <strong style={{ color: 'var(--ink)' }}>My Assistant</strong> — your default persona. Add more later from the Personas page.
        </p>
      </div>

      <div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Response style</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {STYLES.map(s => (
            <RadioCard key={s.id} selected={data.commStyle === s.id} onClick={() => update({ commStyle: s.id })} title={s.title} desc={s.desc} />
          ))}
        </div>
      </div>

      <div>
        <FieldLabel optional hint={`${(data.traits || []).length}/3`}>Traits</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TRAITS.map(t => {
            const sel = (data.traits || []).includes(t);
            const disabled = !sel && (data.traits || []).length >= 3;
            return <Chip key={t} selected={sel} disabled={disabled} onClick={() => toggleTrait(t)}>{t}</Chip>;
          })}
        </div>
      </div>

      <div>
        <FieldLabel optional>Custom instructions</FieldLabel>
        <textarea rows={2} placeholder="e.g. Always ask before making assumptions. Prefer TypeScript examples."
          value={data.customInstr || ''} onChange={e => update({ customInstr: e.target.value })}
          style={{ fontSize: 14, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', color: 'var(--ink)', outline: 'none', width: '100%', fontFamily: 'inherit', resize: 'none', lineHeight: 1.6 }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-bg)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none'; }}
        />
      </div>

      <TipCard
        title="How this becomes a persona"
        body="Your style + traits + instructions compile into a SOUL.md file. Agents using this persona read it on every call. You can edit the compiled markdown directly anytime."
      />
    </div>
  );
}

function StepSecurity({ data, update, masterToken }) {
  const [qrUrl, setQrUrl] = useState(null);
  const [secret, setSecret] = useState(null);
  const [loading2fa, setLoading2fa] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [skipConfirm, setSkipConfirm] = useState(false);

  const alreadyEnabled = !!data.twoFaDone;

  useEffect(() => {
    if (alreadyEnabled) return;
    let cancelled = false;
    setLoading2fa(true);
    fetch('/api/v1/auth/2fa/setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
      credentials: 'include',
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.data?.qrCodeDataUrl) {
          setQrUrl(d.data.qrCodeDataUrl);
          setSecret(d.data.secret);
        } else if (d.data?.enabled || d.error?.toLowerCase().includes('already')) {
          update({ twoFaDone: true });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading2fa(false); });
    return () => { cancelled = true; };
  }, [masterToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const code = data.twoFaCode || '';
  const setCode = (v) => { update({ twoFaCode: v.replace(/\D/g, '').slice(0, 6) }); setVerifyError(null); };

  const handleVerify = async () => {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const r = await fetch('/api/v1/auth/2fa/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(result.error || 'Invalid code — check your app and try again');
      update({ twoFaDone: true });
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Secure your account</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
          Your master token grants full access. Add a second factor so a leaked password alone can't be used.
        </p>
      </div>

      {alreadyEnabled ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--green-bg)', border: '1px solid var(--green)33', borderLeft: '3px solid var(--green)', borderRadius: 8 }}>
          <Icon name="shieldCheck" size={22} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>2FA enabled successfully</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>Your account is protected. Click Continue to proceed.</div>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'flex-start',
          padding: 14, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 8,
        }} className="ob-twofa-grid">
          <div style={{ padding: 6, background: '#fff', borderRadius: 6, flexShrink: 0, minWidth: 160, minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading2fa ? (
              <div style={{ width: 24, height: 24, border: '2px solid #ccc', borderTopColor: '#333', borderRadius: 999, animation: 'ob-spin 0.8s linear infinite' }} />
            ) : qrUrl ? (
              <img src={qrUrl} alt="Scan with authenticator" width={148} height={148} style={{ display: 'block' }} />
            ) : (
              <span style={{ fontSize: 11, color: '#666', textAlign: 'center', padding: 8 }}>QR unavailable — use the secret key below</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>Scan with an authenticator</div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
                Google Authenticator, Authy, 1Password, or your password manager.
              </p>
              {secret && (
                <p style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all' }}>
                  Key: {secret}
                </p>
              )}
            </div>
            <div>
              <FieldLabel>6-digit code</FieldLabel>
              <input inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000"
                value={code} onChange={e => setCode(e.target.value)}
                style={{
                  letterSpacing: '0.35em', textAlign: 'center', fontSize: 20, fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace", padding: '10px 12px',
                  background: 'var(--bg-sunk)', border: `1px solid ${verifyError ? 'var(--red)' : 'var(--line)'}`, borderRadius: 6,
                  color: 'var(--ink)', outline: 'none', width: '100%',
                }}
                onFocus={e => { e.target.style.borderColor = verifyError ? 'var(--red)' : 'var(--accent)'; e.target.style.boxShadow = `0 0 0 3px ${verifyError ? 'var(--red-bg)' : 'var(--accent-bg)'}`; }}
                onBlur={e => { e.target.style.borderColor = verifyError ? 'var(--red)' : 'var(--line)'; e.target.style.boxShadow = 'none'; }}
                onKeyDown={e => { if (e.key === 'Enter' && code.length === 6) handleVerify(); }}
              />
            </div>
            {verifyError && (
              <div style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="close" size={12} strokeWidth={2.5} /> {verifyError}
              </div>
            )}
            <button onClick={handleVerify} disabled={code.length !== 6 || verifying}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: (code.length !== 6 || verifying) ? 'not-allowed' : 'pointer',
                background: code.length === 6 ? 'var(--accent-2)' : 'var(--bg-raised)',
                color: code.length === 6 ? '#fff' : 'var(--ink-4)',
                border: `1px solid ${code.length === 6 ? 'rgba(240,246,252,0.1)' : 'var(--line)'}`,
                opacity: verifying ? 0.7 : 1, transition: 'all 0.15s', minHeight: 38,
              }}>
              {verifying
                ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: 999, animation: 'ob-spin 0.8s linear infinite' }} /> Verifying…</>
                : <><Icon name="shieldCheck" size={14} /> Verify &amp; Enable 2FA</>}
            </button>
          </div>
        </div>
      )}

      <TipCard
        variant="security"
        title="Why 2FA matters here"
        body="MyApi's master token can issue scoped credentials to any AI agent. Even if someone steals your password, they cannot log in, issue tokens, or read your vault without the authenticator code."
      />

      {!alreadyEnabled && !data.twoFaSkipped && (
        skipConfirm ? (
          <div style={{ padding: '12px 14px', background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.35)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="alertTriangle" size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 3 }}>Skipping 2FA leaves your account exposed</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  Your master token can issue credentials to any AI agent. Without 2FA, a stolen password is enough for full access. You can enable it later in Settings › Security.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSkipConfirm(false)} style={{ flex: 1, padding: '7px 12px', fontSize: 12.5, fontWeight: 500, borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink-2)', cursor: 'pointer' }}>
                Go back &amp; enable 2FA
              </button>
              <button onClick={() => { update({ twoFaSkipped: true }); setSkipConfirm(false); }} style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 500, borderRadius: 5, border: '1px solid rgba(248,81,73,0.4)', background: 'transparent', color: 'var(--red)', cursor: 'pointer' }}>
                Skip anyway
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => setSkipConfirm(true)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--ink-4)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Skip for now
            </button>
          </div>
        )
      )}

      {data.twoFaSkipped && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'rgba(248,81,73,0.07)', border: '1px solid rgba(248,81,73,0.25)', borderRadius: 6 }}>
          <Icon name="alertTriangle" size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>2FA skipped — enable it anytime in <strong style={{ color: 'var(--ink-2)' }}>Settings › Security</strong></span>
        </div>
      )}
    </div>
  );
}

const SERVICES = [
  { id: 'github',    name: 'GitHub',      desc: 'Repos, issues, PRs',     icon: SvcIcon.github    },
  { id: 'google',    name: 'Google',      desc: 'Gmail, Drive, Calendar',  icon: SvcIcon.google    },
  { id: 'slack',     name: 'Slack',       desc: 'Messages, channels',      icon: SvcIcon.slack     },
  { id: 'discord',   name: 'Discord',     desc: 'Servers, messages',       icon: SvcIcon.discord   },
  { id: 'twitter',   name: 'Twitter / X', desc: 'Posts, DMs',              icon: SvcIcon.twitter   },
  { id: 'linkedin',  name: 'LinkedIn',    desc: 'Profile, posts',          icon: SvcIcon.linkedin  },
  { id: 'instagram', name: 'Instagram',   desc: 'Feed, stories',           icon: SvcIcon.instagram },
  { id: 'facebook',  name: 'Facebook',    desc: 'Pages, groups',           icon: SvcIcon.facebook  },
  { id: 'reddit',    name: 'Reddit',      desc: 'Posts, comments',         icon: SvcIcon.reddit    },
  { id: 'whatsapp',  name: 'WhatsApp',    desc: 'Messages, contacts',      icon: SvcIcon.whatsapp  },
  { id: 'tiktok',    name: 'TikTok',      desc: 'Videos, analytics',       icon: SvcIcon.tiktok    },
];

function StepConnect({ data, update }) {
  const connected = data.connected || [];

  // On mount, sync already-connected services from the backend (e.g. signup via Google)
  useEffect(() => {
    fetch('/api/v1/oauth/status', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(result => {
        if (!result?.services) return;
        const alreadyConnected = result.services
          .filter(s => s.status === 'connected')
          .map(s => s.name);
        if (alreadyConnected.length === 0) return;
        update({ connected: [...new Set([...(data.connected || []), ...alreadyConnected])] });
      })
      .catch(() => { /* ignore */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectNow = (id) => {
    const params = new URLSearchParams({ mode: 'connect', returnTo: '/dashboard/onboarding', redirect: '1' });
    window.location.href = `/api/v1/oauth/authorize/${id}?${params.toString()}`;
  };

  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Connect your first service</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
          OAuth once — MyApi proxies every request. Your raw tokens stay encrypted and never reach your agents.
        </p>
      </div>

      <div className="ob-svc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {SERVICES.map(s => {
          const sel = connected.includes(s.id);
          return (
            <button key={s.id} onClick={() => !sel && connectNow(s.id)} disabled={sel} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '16px 8px', borderRadius: 8, cursor: sel ? 'default' : 'pointer',
              background: sel ? 'rgba(34,197,94,0.08)' : 'var(--bg-sunk)',
              border: `1.5px solid ${sel ? '#22c55e' : 'var(--line)'}`,
              color: 'var(--ink)', position: 'relative', transition: 'all 0.2s',
              opacity: sel ? 1 : undefined,
            }}>
              {sel && (
                <span style={{
                  position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 999,
                  background: '#22c55e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="check" size={10} strokeWidth={4} />
                </span>
              )}
              <span style={{ color: sel ? '#22c55e' : 'var(--ink-2)', transition: 'color 0.2s' }}>{s.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: sel ? '#22c55e' : 'var(--ink)' }}>{s.name}</span>
              <span style={{ fontSize: 11, color: sel ? 'rgba(34,197,94,0.7)' : 'var(--ink-3)' }}>{sel ? 'Connected' : s.desc}</span>
            </button>
          );
        })}
        <a href="/dashboard/services" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          padding: '16px 8px', borderRadius: 8, cursor: 'pointer',
          background: 'var(--bg-sunk)', border: '1px dashed var(--line)',
          color: 'var(--ink-3)', textDecoration: 'none', transition: 'all 0.15s',
        }}>
          <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>More</span>
          <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>34+ services</span>
        </a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6 }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
          {connected.length === 0
            ? 'Skip to add services later from the Services page.'
            : `${connected.length} service${connected.length === 1 ? '' : 's'} connected — add more anytime.`}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>45+ total</span>
      </div>

      <TipCard
        variant="security"
        title="Your credentials never leave MyApi"
        body="When an agent calls a connected service through MyApi, we attach your OAuth token server-side, then strip it from the response. The agent sees the data but never the secret. Revoke anything in one click."
      />
    </div>
  );
}

function StepToken({ data, update, newToken }) {
  const [copied, setCopied] = useState(false);
  const scopes = data.scopes || ['knowledge:read', 'services:read'];

  const toggleScope = (s) => {
    if (scopes.includes(s)) update({ scopes: scopes.filter(x => x !== s) });
    else update({ scopes: [...scopes, s] });
  };

  const displayToken = newToken || '—';
  const copy = () => {
    if (newToken) {
      navigator.clipboard?.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Issue your first agent token</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
          Name the agent, pick the scopes it needs. You can revoke this token any time without affecting anything else.
        </p>
      </div>

      <div>
        <FieldLabel required>Agent name</FieldLabel>
        <input type="text" placeholder="e.g. Claude Desktop, my-coding-bot"
          value={data.tokenName || ''} onChange={e => update({ tokenName: e.target.value })}
          style={{ fontSize: 14, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', color: 'var(--ink)', outline: 'none', width: '100%', fontFamily: 'inherit' }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-bg)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none'; }}
        />
      </div>

      <div>
        <FieldLabel>Scopes <span style={{ color: 'var(--ink-4)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>— least-privilege by default</span></FieldLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: 4 }}>
          {ALL_SCOPES.map(s => {
            const sel = scopes.includes(s.id);
            return (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer', borderRadius: 4, background: sel ? 'var(--bg-raised)' : 'transparent' }}>
                <input type="checkbox" checked={sel} onChange={() => toggleScope(s.id)} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                <code style={{ fontSize: 12, color: s.write ? 'var(--amber)' : 'var(--ink)', background: 'var(--bg)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--line)' }}>
                  {s.id}
                </code>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{s.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {newToken ? (
        <div>
          <FieldLabel>Token — copy now, shown once</FieldLabel>
          <div style={{ position: 'relative', background: 'var(--bg-sunk)', border: '1px solid var(--green)', borderRadius: 6, padding: '12px 44px 12px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: 'var(--ink)', wordBreak: 'break-all', lineHeight: 1.5 }}>
            {displayToken}
            <button onClick={copy} style={{ position: 'absolute', top: 8, right: 8, padding: 6, borderRadius: 4, border: `1px solid ${copied ? 'var(--green)' : 'var(--line)'}`, background: copied ? 'var(--green-bg)' : 'var(--bg-raised)', color: copied ? 'var(--green)' : 'var(--ink-3)', display: 'inline-flex' }}>
              <Icon name={copied ? 'check' : 'copy'} size={13} strokeWidth={copied ? 3 : 1.75} />
            </button>
          </div>
        </div>
      ) : (data.tokenName || '').trim() ? (
        <div style={{ padding: '10px 14px', background: 'var(--accent-bg)', border: '1px solid var(--accent-2)33', borderRadius: 6, fontSize: 12.5, color: 'var(--ink-2)' }}>
          Token will be created when you click Continue. Copy it immediately — it's shown once.
        </div>
      ) : null}

      <TipCard
        variant="warn"
        title="You'll only see this token once"
        body="MyApi stores a bcrypt hash — the plaintext lives only in your clipboard. If lost, revoke and issue a new one. Never paste tokens into public code or chats."
      />
    </div>
  );
}

const CONNECTION_METHODS = [
  {
    id: 'device', title: 'OAuth Device Flow',
    badge: { text: 'Recommended', color: 'var(--accent)', bg: 'var(--accent-bg)', border: 'var(--accent-2)' },
    desc: 'Agent shows a short code, you approve in the browser. Each agent gets its own scoped token.',
    icon: <Icon name="shieldCheck" size={18} />,
  },
  {
    id: 'master', title: 'Master Token',
    badge: { text: 'Simplest', color: 'var(--amber)', bg: 'var(--amber-bg)', border: 'var(--amber)' },
    desc: 'Paste your master token into any HTTP client. Zero setup — works immediately.',
    icon: <Icon name="key" size={18} />,
  },
  {
    id: 'asc', title: 'ASC — Ed25519 Keypair',
    badge: { text: 'Advanced', color: 'var(--violet)', bg: 'var(--violet-bg)', border: 'var(--violet)' },
    desc: 'Agent signs every request; private key never transmitted. For production pipelines.',
    icon: <Icon name="lock" size={18} />,
  },
];

const AGENT_PROMPT = `I'd like you to connect to my MyApi context API.

Read the guide (no auth needed):
  curl -s https://www.myapiai.com/api/v1/agent-guide

Then:
1. Summarize what MyApi can do
2. Walk me through the three connection methods
3. Recommend the best one for me, and guide me through setup step-by-step.`;

function StepAgent({ data, update }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(AGENT_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Connect your AI agent</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
          Pick how agents authenticate. You can mix methods — different agents, different trust levels.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CONNECTION_METHODS.map(m => (
          <RadioCard key={m.id} selected={data.agentMethod === m.id} onClick={() => update({ agentMethod: m.id })} title={m.title} desc={m.desc} icon={m.icon} badge={m.badge} />
        ))}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Or let your AI walk you through it</span>
          <button onClick={copy} style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11.5, fontWeight: 500, border: `1px solid ${copied ? 'var(--green)' : 'var(--line)'}`, background: copied ? 'var(--green-bg)' : 'var(--bg-raised)', color: copied ? 'var(--green)' : 'var(--ink-2)', display: 'inline-flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
            <Icon name={copied ? 'check' : 'copy'} size={11} strokeWidth={copied ? 3 : 1.75} />
            {copied ? 'Copied' : 'Copy prompt'}
          </button>
        </div>
        <pre style={{ margin: 0, padding: 12, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11.5, lineHeight: 1.6, color: 'var(--ink-2)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {AGENT_PROMPT}
        </pre>
      </div>

      <TipCard
        title="Your agent reads, you decide"
        body="Paste this prompt into any AI — Claude, ChatGPT, Gemini. It fetches the connection guide from your API and walks you through choosing and setting up a method. Nothing is sent until you approve."
      />
    </div>
  );
}

function ObCopyBlock({ label, text, accent = 'blue' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const accentColor = accent === 'violet' ? '#a78bfa' : 'var(--accent)';
  return (
    <div style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>{label}</span>
        <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: accentColor }}>
          {copied
            ? <><svg style={{ width: 11, height: 11 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Copied</>
            : <><svg style={{ width: 11, height: 11 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>}
        </button>
      </div>
      <pre style={{ margin: 0, padding: 12, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'JetBrains Mono', monospace" }}><code>{text}</code></pre>
    </div>
  );
}

function ObStep({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, paddingBottom: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-hover)', border: '1px solid var(--line)', color: 'var(--ink-3)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
        <div style={{ width: 1, flex: 1, background: 'var(--line)', minHeight: 16, marginTop: 4 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{title}</p>
        {children}
      </div>
    </div>
  );
}

function StepAgentSetup({ data, masterToken }) {
  const method = data.agentMethod;
  const token = masterToken || '<your-master-token>';

  if (!method) {
    return (
      <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Agent setup</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>Go back and pick a connection method first.</p>
      </div>
    );
  }

  const titles = { device: 'OAuth Device Flow setup', master: 'Master token setup', asc: 'ASC keypair setup' };
  const subtitles = {
    device: 'Run the installer on your machine. Your browser opens, you authorize, and the terminal prints a per-agent token.',
    master: 'Paste your master token directly into your agent or HTTP client. Zero setup — works immediately.',
    asc: 'Your agent generates an Ed25519 keypair and signs every request. The private key never leaves its machine.',
  };

  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>{titles[method]}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>{subtitles[method]}</p>
      </div>

      {method === 'device' && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, borderRadius: 6, border: '1px solid var(--accent-bg)', background: 'var(--accent-bg)', padding: '10px 14px' }}>
            <Icon name="tip" size={14} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: 'var(--accent)', lineHeight: 1.5, margin: 0 }}>
              <strong style={{ fontWeight: 600 }}>You run this on your machine</strong> — not the agent. Agents in sandboxes can't receive localhost callbacks.
            </p>
          </div>

          <ObStep n="1" title="Run the installer on your machine">
            <ObCopyBlock label="terminal" accent="blue" text="curl -sL https://www.myapiai.com/api/v1/agent-auth/install.js | node" />
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>Your browser opens. Once you authorize, the terminal prints a token starting with <code style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink)' }}>myapi_</code></p>
          </ObStep>

          <ObStep n="2" title="Give the token to your agent">
            <ObCopyBlock label="agent prompt" accent="blue" text={`I ran the MyApi agent auth installer on my machine and got this access token:\n\nmyapi_PASTE_TOKEN_HERE\n\nPlease save this as your MyApi Bearer token and use it for all API requests:\n  Authorization: Bearer myapi_PASTE_TOKEN_HERE\n  Base URL: https://www.myapiai.com/api/v1/\n\nDo not ask me to run the installer — I already ran it. Just use this token.`} />
          </ObStep>

          <div style={{ borderRadius: 6, background: 'var(--bg-sunk)', border: '1px solid var(--line)', padding: '12px 14px' }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 8 }}>Optional flags</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace" }}>
              <p><span style={{ color: 'var(--ink)' }}>--save</span>  → saves token to <span style={{ color: 'var(--ink-2)' }}>~/.myapi/agent-token.json</span></p>
              <p><span style={{ color: 'var(--ink)' }}>--json</span>  → outputs <span style={{ color: 'var(--ink-2)' }}>{`{"token":"myapi_..."}`}</span> for scripting</p>
            </div>
          </div>
        </>
      )}

      {method === 'master' && (
        <>
          <div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>Your master token</p>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '10px 14px', background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--ink)', wordBreak: 'break-all', lineHeight: 1.6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ flex: 1 }}>{token}</span>
            </div>
          </div>
          <ObStep n="1" title="Tell your agent">
            <ObCopyBlock label="agent prompt" accent="blue" text={`Use this as your MyApi Bearer token for all API requests:\n  Authorization: Bearer ${token}\n  Base URL: https://www.myapiai.com/api/v1/`} />
          </ObStep>
          <ObStep n="2" title="Test it">
            <ObCopyBlock label="terminal" accent="blue" text={`curl -s https://www.myapiai.com/api/v1/me \\\n  -H "Authorization: Bearer ${token}"`} />
          </ObStep>
          <TipCard
            title="Keep this token secret"
            body="Never commit it to git or paste it in public chats. It grants full access to your account. Revoke and reissue any time from Settings › Security."
          />
        </>
      )}

      {method === 'asc' && (
        <>
          <ObStep n="1" title="Send this prompt to your agent">
            <ObCopyBlock label="agent prompt" accent="violet" text={`Please set up an ASC (Agentic Secure Connection) to my MyApi account so you have a stable cryptographic identity across sessions and IPs.\n\n── SETUP (one time) ──────────────────────────────────────────\n\n1. Generate an Ed25519 keypair and extract the raw 32-byte public key:\n   const { generateKeyPairSync } = require('crypto');\n   const { privateKey, publicKey } = generateKeyPairSync('ed25519');\n   const pubKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('base64');\n   Save privateKey and pubKeyB64 to disk before continuing — never keep them only in memory.\n\n2. Fetch your token ID — you'll need it for signing:\n   GET https://www.myapiai.com/api/v1/auth/me\n   Authorization: Bearer <your-token>\n   → Save the value at bootstrap.tokenId (format: tok_xxxxxxxx...)\n   This ID is fixed for your token. Fetch it once on startup, not on every request.\n\n3. Register your public key:\n   POST https://www.myapiai.com/api/v1/agentic/asc/register\n   Authorization: Bearer <your-token>\n   Content-Type: application/json\n   Body: {"public_key":"<pubKeyB64>","label":"<your-agent-name>"}\n   Show me the key_fingerprint from the response — I need to approve it.\n\n── SIGNING (every request after approval) ────────────────────\n\nAdd these 3 headers to every API request:\n  X-Agent-PublicKey:  <pubKeyB64>\n  X-Agent-Timestamp:  <current Unix seconds as string>\n  X-Agent-Signature:  base64( Ed25519_sign(privateKey, Buffer.from(timestamp + ":" + tokenId)) )\n\nKeep Authorization: Bearer <your-token> as well.\n\n── COMMON MISTAKES ───────────────────────────────────────────\n\n✗ tokenId is NOT the token secret (myapi_...), NOT the hash, NOT the fingerprint\n✓ tokenId looks like: tok_a44fbb8effb427b4bd51f32606e5d4f2\n\n✗ Do NOT regenerate the keypair on each session — load it from disk\n✓ Persist privateKey and pubKeyB64 to ~/.myapi-asc.key (or equivalent)\n\n✗ Do NOT hardcode tokenId — fetch it via /auth/me on startup\n✓ tokenId stays the same as long as the token is not revoked`} />
          </ObStep>

          <ObStep n="2" title="Approve the key">
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              Your agent shows you a short key fingerprint. Go to{' '}
              <a href="/dashboard/devices" style={{ color: '#a78bfa', textDecoration: 'underline', textUnderlineOffset: 2 }}>Dashboard → Devices</a>,
              find the pending ASC request, and click Approve.
            </p>
          </ObStep>

          <div style={{ borderRadius: 6, background: 'var(--bg-sunk)', border: '1px solid var(--line)', padding: '12px 14px' }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 8 }}>Signing — Node.js quick reference</p>
            <pre style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', monospace" }}>{`const ts  = String(Math.floor(Date.now() / 1000));
const msg = Buffer.from(\`\${ts}:\${tokenId}\`);
const sig = crypto.sign(null, msg, privateKey).toString('base64');
// X-Agent-Timestamp: ts
// X-Agent-Signature: sig
// X-Agent-PublicKey: pubKeyB64`}</pre>
          </div>
        </>
      )}
    </div>
  );
}

function StepFinish({ data, onNavigate }) {
  const checks = [
    { label: 'Profile & USER.md', done: !!(data.name), where: 'Identity' },
    { label: 'Default persona', done: !!data.commStyle, where: 'Personas' },
    { label: '2FA enabled', done: !!(data.twoFaDone || (data.twoFaCode || '').length === 6), where: 'Settings › Security' },
    { label: `${(data.connected || []).length} service${(data.connected || []).length === 1 ? '' : 's'} connected`, done: (data.connected || []).length > 0, where: 'Services' },
    { label: 'First agent token', done: !!data.tokenName, where: 'Access Tokens' },
    { label: 'Agent connection method', done: !!data.agentMethod, where: 'Access Tokens' },
  ];
  const nextSteps = [
    { icon: <Icon name="book" size={18} />, title: 'Add Knowledge', desc: 'Upload docs, SOPs, notes that ground your agents.', route: '/knowledge' },
    { icon: <Icon name="brain" size={18} />, title: 'Build Another Persona', desc: 'Specialized roles — coder, writer, ops.', route: '/personas' },
    { icon: <Icon name="bolt" size={18} />, title: 'Install a Skill', desc: 'Reusable capability modules from the marketplace.', route: '/marketplace' },
    { icon: <Icon name="terminal" size={18} />, title: 'Read the API Docs', desc: 'Every endpoint, every scope, with examples.', route: '/api-docs' },
  ];
  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, margin: '0 auto 12px', background: 'var(--green-bg)', border: '1px solid var(--green)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
          <Icon name="check" size={28} strokeWidth={2.5} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>You're all set</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
          Your MyApi workspace is configured. Here's what we populated — and where to go next.
        </p>
      </div>

      <div style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
        {checks.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)' }}>
            <span style={{ width: 16, height: 16, borderRadius: 999, flexShrink: 0, background: c.done ? 'var(--green)' : 'transparent', border: `1px solid ${c.done ? 'var(--green)' : 'var(--line)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              {c.done && <Icon name="check" size={9} strokeWidth={4} />}
            </span>
            <span style={{ fontSize: 13, color: c.done ? 'var(--ink)' : 'var(--ink-3)', flex: 1 }}>{c.label}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>{c.where}</span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>What's next</div>
        <div className="ob-nextgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {nextSteps.map(n => (
            <button key={n.title} onClick={() => onNavigate(n.route)} style={{ padding: 12, textAlign: 'left', borderRadius: 6, background: 'var(--bg-raised)', border: '1px solid var(--line)', cursor: 'pointer', color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 6, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--accent-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.borderColor = 'var(--line)'; }}>
              <span style={{ color: 'var(--accent)' }}>{n.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>{n.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 'profile',  label: 'Profile'  },
  { id: 'persona',  label: 'Persona'  },
  { id: 'security', label: 'Security' },
  { id: 'connect',      label: 'Connect'  },
  { id: 'agent',        label: 'Agent'    },
  { id: 'agent-setup',  label: 'Setup'    },
  { id: 'finish',       label: 'All set'  },
];

const STORAGE_KEY = 'myapi_onboarding_v2';

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return { step: 0, data: {} };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const masterToken = useAuthStore(s => s.masterToken);
  const setUser = useAuthStore(s => s.setUser);

  const saved = loadSaved();
  const [step, setStep] = useState(saved.step || 0);
  const [data, setData] = useState(() => {
    const d = saved.data || {};
    if (!d.name && user?.displayName) d.name = user.displayName;
    return d;
  });
  const [mobileSide, setMobileSide] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stepError, setStepError] = useState(null);

  const update = useCallback((patch) => setData(d => ({ ...d, ...patch })), []);

  // Detect OAuth connect return: ?oauth_status=connected&oauth_service=github
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const oauthStatus = p.get('oauth_status');
    const oauthService = p.get('oauth_service');
    if (oauthStatus === 'connected' && oauthService) {
      update({ connected: [...new Set([...(data.connected || []), oauthService])] });
      // Find connect step index and jump to it
      const connectIdx = STEPS.findIndex(s => s.id === 'connect');
      if (connectIdx >= 0) setStep(connectIdx);
      // Strip params from URL without reload
      const clean = window.location.pathname;
      window.history.replaceState({}, document.title, clean);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data })); } catch (_) { /* ignore */ }
  }, [step, data]);

  const canAdvance = (() => {
    switch (STEPS[step].id) {
      case 'profile': return !!(data.name || '').trim();
      case 'persona': return !!data.commStyle;
      case 'security': return !!(data.twoFaCode?.length === 6 || data.twoFaDone || data.twoFaSkipped);
      case 'agent': return !!data.agentMethod;
      case 'agent-setup': return true;
      default: return true;
    }
  })();

  const handleAdvance = async () => {
    if (!canAdvance) return;
    setStepError(null);
    setSaving(true);
    try {
      const sid = STEPS[step].id;
      const auth = { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' };

      if (sid === 'profile') {
        if ((data.name || '').trim()) {
          await fetch('/api/v1/users/me', {
            method: 'PUT',
            headers: auth,
            credentials: 'include',
            body: JSON.stringify({
              displayName: data.name.trim(),
              ...(data.role ? { Role: data.role } : {}),
              ...(data.bio ? { Bio: data.bio } : {}),
              ...(data.tz && data.tz !== 'auto' ? { Timezone: data.tz } : {}),
            }),
          });
        }
      }

      if (sid === 'persona' && data.commStyle) {
        const styleDesc = { direct: 'Direct and concise. Short answers. Skip preamble.', detailed: 'Detailed and thorough. Explain reasoning, show examples.', casual: 'Casual and collaborative. Conversational, thinks out loud.' }[data.commStyle] || data.commStyle;
        const traitsList = (data.traits || []).length > 0 ? `\n\n## Traits\n${(data.traits || []).map(t => `- ${t}`).join('\n')}` : '';
        const instrSection = data.customInstr ? `\n\n## Custom Instructions\n${data.customInstr}` : '';
        const soulContent = `# My Assistant\n\n## Response Style\n${styleDesc}${traitsList}${instrSection}`;
        const r = await fetch('/api/v1/personas', {
          method: 'POST',
          headers: auth,
          credentials: 'include',
          body: JSON.stringify({ name: 'My Assistant', soul_content: soulContent, description: 'Default persona created during setup' }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          if (!e.error?.includes('limit')) throw new Error(e.error || 'Failed to create persona');
        }
      }

      if (sid === 'security' && data.twoFaCode?.length === 6 && !data.twoFaDone) {
        const r = await fetch('/api/v1/auth/2fa/verify', {
          method: 'POST',
          headers: auth,
          credentials: 'include',
          body: JSON.stringify({ code: data.twoFaCode }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || 'Invalid 2FA code — try again');
        }
        update({ twoFaDone: true });
      }

      setStep(s => Math.min(STEPS.length - 1, s + 1));
    } catch (err) {
      setStepError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await fetch('/api/v1/onboarding/complete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}` },
        credentials: 'include',
      });
      completeOnboarding();
      dismissModal();
      if (setUser && user) setUser({ ...user, needsOnboarding: false });
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
      navigate('/');
    } catch {
      navigate('/');
    }
  };

  const goTo = (i) => {
    if (i < step) setStep(i);
  };

  const back = () => {
    if (step > 0) { setStep(s => s - 1); setStepError(null); }
  };

  const skip = () => {
    setStepError(null);
    setStep(s => Math.min(STEPS.length - 1, s + 1));
  };

  const onNavigate = (route) => {
    handleFinish().then(() => navigate(route));
  };

  const isFinish = step === STEPS.length - 1;

  const renderStep = () => {
    const sid = STEPS[step].id;
    if (sid === 'profile')  return <StepProfile  data={data} update={update} />;
    if (sid === 'persona')  return <StepPersona  data={data} update={update} />;
    if (sid === 'security') return <StepSecurity data={data} update={update} masterToken={masterToken} />;
    if (sid === 'connect')  return <StepConnect  data={data} update={update} key="connect" />;
    if (sid === 'agent')       return <StepAgent      data={data} update={update} />;
    if (sid === 'agent-setup') return <StepAgentSetup data={data} masterToken={masterToken} />;
    if (sid === 'finish')      return <StepFinish     data={data} onNavigate={onNavigate} />;
    return null;
  };

  return (
    <>
      <style>{`
        @keyframes ob-step-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .ob-step-enter { animation: ob-step-in 0.32s cubic-bezier(0.2,0.8,0.2,1) both; }
        @keyframes ob-spin { to { transform: rotate(360deg); } }
        @keyframes ob-slide-left { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .ob-sidebar { display: flex !important; }
        .ob-mobile-header { display: none !important; }
        .ob-mobile-progress { display: none !important; }
        .ob-desktop-only { display: inline !important; }
        @media (max-width: 860px) {
          .ob-sidebar { display: none !important; }
          .ob-mobile-header { display: flex !important; }
          .ob-mobile-progress { display: block !important; }
          .ob-content-col { padding: 20px 16px 24px !important; max-width: 100% !important; }
          .ob-footer { padding: 12px 16px !important; }
          .ob-desktop-only { display: none !important; }
          .ob-layout { flex-direction: column !important; }
          .ob-svc-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .ob-nextgrid { grid-template-columns: 1fr !important; }
          .ob-twofa-grid { grid-template-columns: 1fr !important; }
          .ob-twofa-grid > div:first-child { margin: 0 auto; }
          input, textarea, select { font-size: 16px !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)', fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
        <div style={{ display: 'flex', flex: 1 }} className="ob-layout">

          {/* Desktop sidebar */}
          <aside className="ob-sidebar" style={{
            width: 260, padding: 24, borderRight: '1px solid var(--line)',
            background: 'var(--bg-sunk)', flexDirection: 'column', gap: 20,
            height: '100vh', position: 'sticky', top: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Logo size={28} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>MyApi</span>
            </div>

            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>Getting started</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                {step + 1} of {STEPS.length} · ~{Math.max(1, STEPS.length - step)} min left
              </div>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              {STEPS.map((s, i) => (
                <StepChip key={s.id} index={i} current={step} label={s.label} onClick={() => goTo(i)} />
              ))}
            </nav>

            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-raised)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--ink-2)', fontWeight: 600, fontSize: 12.5 }}>
                <Icon name="sparkles" size={13} />
                <span>Resume anytime</span>
              </div>
              Close this tab and come back — your progress is saved locally.
            </div>
          </aside>

          {/* Mobile header */}
          <header className="ob-mobile-header" style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: 'var(--bg)', borderBottom: '1px solid var(--line)',
            padding: '12px 16px', alignItems: 'center', gap: 12,
          }}>
            <button style={{ padding: 8, background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--ink-2)', display: 'flex', cursor: 'pointer' }}
              onClick={() => setMobileSide(true)}>
              <Icon name="chevron" size={18} />
            </button>
            <Logo size={22} />
            <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Setup</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--ink-3)' }}>{step + 1}/{STEPS.length}</span>
          </header>

          {/* Main content */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Mobile progress */}
            <div className="ob-mobile-progress" style={{ padding: '12px 16px 0' }}>
              <MobileProgress current={step} total={STEPS.length} />
            </div>

            <div className="ob-content-col" style={{ flex: 1, padding: '40px 48px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
              {renderStep()}
            </div>

            {/* Footer */}
            <footer className="ob-footer" style={{
              borderTop: '1px solid var(--line)', padding: '14px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg)', position: 'sticky', bottom: 0,
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {step > 0 && !isFinish && (
                  <button onClick={back} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 500, border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink)', borderRadius: 6, cursor: 'pointer', minHeight: 36 }}>
                    <Icon name="arrowLeft" size={14} /> Back
                  </button>
                )}
                {!isFinish && STEPS[step].id !== 'security' && STEPS[step].id !== 'token' && (
                  <button onClick={skip} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12.5, fontWeight: 500, border: 'none', background: 'transparent', color: 'var(--ink-3)', borderRadius: 6, cursor: 'pointer' }}>
                    Skip for now
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {stepError && (
                  <span style={{ fontSize: 12, color: 'var(--red)', maxWidth: 220, textAlign: 'right' }}>{stepError}</span>
                )}
                <span className="ob-desktop-only" style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {!isFinish && <>Press <kbd style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, background: 'var(--bg-raised)', border: '1px solid var(--line)', borderBottomWidth: 2, padding: '1px 5px', color: 'var(--ink-2)', borderRadius: 4 }}>Enter</kbd></>}
                </span>
                {!isFinish ? (
                  <button onClick={handleAdvance} disabled={!canAdvance || saving} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: (!canAdvance || saving) ? 'not-allowed' : 'pointer',
                    background: 'var(--accent-2)', color: '#fff', border: '1px solid rgba(240,246,252,0.1)',
                    opacity: (!canAdvance || saving) ? 0.5 : 1, minHeight: 36, transition: 'opacity 0.15s',
                  }}>
                    {saving ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: 999, animation: 'ob-spin 0.8s linear infinite' }} /> : null}
                    {step === STEPS.length - 2 ? 'Finish setup' : 'Continue'}
                    {!saving && <Icon name="arrowRight" size={14} />}
                  </button>
                ) : (
                  <button onClick={handleFinish} disabled={saving} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer',
                    background: 'var(--accent-2)', color: '#fff', border: '1px solid rgba(240,246,252,0.1)',
                    opacity: saving ? 0.5 : 1, minHeight: 36,
                  }}>
                    {saving ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: 999, animation: 'ob-spin 0.8s linear infinite' }} /> : null}
                    Go to dashboard <Icon name="arrowRight" size={14} />
                  </button>
                )}
              </div>
            </footer>
          </main>
        </div>

        {/* Mobile side drawer */}
        {mobileSide && (
          <div onClick={() => setMobileSide(false)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <aside onClick={e => e.stopPropagation()} style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 280,
              background: 'var(--bg-raised)', borderRight: '1px solid var(--line)',
              padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
              animation: 'ob-slide-left 0.25s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Logo size={24} /><span style={{ fontWeight: 600 }}>MyApi</span>
                </div>
                <button style={{ padding: 6, background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex' }} onClick={() => setMobileSide(false)}>
                  <Icon name="close" size={16} />
                </button>
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {STEPS.map((s, i) => (
                  <StepChip key={s.id} index={i} current={step} label={s.label} onClick={() => { goTo(i); setMobileSide(false); }} />
                ))}
              </nav>
            </aside>
          </div>
        )}
      </div>

      <OnboardingKeyHandler onEnter={handleAdvance} canAdvance={canAdvance && !saving && !isFinish} />
    </>
  );
}

function OnboardingKeyHandler({ onEnter, canAdvance }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && canAdvance && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        onEnter();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onEnter, canAdvance]);
  return null;
}
