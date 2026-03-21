import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

function FalImageGenerator() {
  const masterToken = useAuthStore(s => s.masterToken);
  
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model, setModel] = useState('fal-ai/fast-sdxl');
  const [models, setModels] = useState([]);
  const [images, setImages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [guidance, setGuidance] = useState(7.5);
  const [steps, setSteps] = useState(25);
  const [numImages, setNumImages] = useState(1);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/v1/fal/models', {
        headers: masterToken ? { Authorization: `Bearer ${masterToken}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setModels(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateImage = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError('');
    setProgress(0);
    setImages([]);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + Math.random() * 30, 90));
      }, 500);

      const response = await fetch('/api/v1/fal/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {})
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negative_prompt: negativePrompt.trim(),
          model,
          num_images: numImages,
          guidance_scale: guidance,
          num_inference_steps: steps
        })
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();
      setProgress(100);

      // Extract image URLs from FAL response
      if (data.data?.images) {
        const imageUrls = data.data.images.map((img, idx) => ({
          id: `${data.requestId}-${idx}`,
          url: img.url || img,
          prompt: prompt.trim(),
          model,
          generatedAt: new Date().toISOString()
        }));
        setImages(prev => [...imageUrls, ...prev]);
      }

      // Reset form
      setTimeout(() => {
        setPrompt('');
        setNegativePrompt('');
        setProgress(0);
      }, 2000);

    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate image');
      setProgress(0);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'generated-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-slate-400">Loading FAL Image Generator...</p>
        </div>
      </div>
    );
  }

  const selectedModel = models.find(m => m.id === model);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white">✨ AI Image Generator</h1>
        <p className="mt-2 text-slate-400">Generate stunning images using FAL's powerful AI models</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Generator Panel */}
        <div className="lg:col-span-1 space-y-6">
          <form onSubmit={generateImage} className="space-y-6">
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isGenerating}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.recommended ? '⭐' : ''} {m.new ? '🆕' : ''}
                  </option>
                ))}
              </select>
              {selectedModel && (
                <p className="text-xs text-slate-400 mt-1">{selectedModel.description}</p>
              )}
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Prompt *</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                disabled={isGenerating}
                rows={5}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">Be detailed and specific for better results</p>
            </div>

            {/* Negative Prompt */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Negative Prompt (optional)</label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="What to avoid in the image..."
                disabled={isGenerating}
                rows={2}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50 resize-none"
              />
            </div>

            {/* Advanced Options */}
            <div className="border-t border-slate-700 pt-4 space-y-4">
              <h3 className="font-semibold text-white text-sm">Advanced</h3>
              
              <div>
                <label className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white">Images: {numImages}</span>
                  <span className="text-xs text-slate-400">(max {selectedModel?.maxImages || 4})</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max={selectedModel?.maxImages || 4}
                  value={numImages}
                  onChange={(e) => setNumImages(parseInt(e.target.value))}
                  disabled={isGenerating}
                  className="w-full"
                />
              </div>

              <div>
                <label className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white">Guidance: {guidance.toFixed(1)}</span>
                  <span className="text-xs text-slate-400">(1-20)</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={guidance}
                  onChange={(e) => setGuidance(parseFloat(e.target.value))}
                  disabled={isGenerating}
                  className="w-full"
                />
              </div>

              <div>
                <label className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white">Steps: {steps}</span>
                  <span className="text-xs text-slate-400">(1-100)</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={steps}
                  onChange={(e) => setSteps(parseInt(e.target.value))}
                  disabled={isGenerating}
                  className="w-full"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-900 bg-opacity-30 border border-red-700 p-3">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Generate Button */}
            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating... {progress.toFixed(0)}%
                </span>
              ) : (
                '✨ Generate Image'
              )}
            </button>
          </form>

          {/* Info Box */}
          {selectedModel && (
            <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
              <p className="text-xs text-blue-200 leading-relaxed">
                <strong>⏱️ Avg time:</strong> {selectedModel.avgGenerationTime}<br/>
                {selectedModel.supportsNegativePrompt && <strong>✓ Negative prompts supported</strong>}
              </p>
            </div>
          )}
        </div>

        {/* Gallery Panel */}
        <div className="lg:col-span-2">
          {images.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800 bg-opacity-30 h-96 flex flex-col items-center justify-center text-center p-8">
              <div className="text-5xl mb-3">🎨</div>
              <p className="text-white font-semibold mb-2">No images generated yet</p>
              <p className="text-slate-400 text-sm">Write a prompt and click generate to create your first image</p>
            </div>
          )}

          {images.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Generated Images</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {images.map(img => (
                  <div key={img.id} className="group rounded-xl border border-slate-700 overflow-hidden bg-slate-800 hover:border-slate-600 transition-all">
                    <div className="relative aspect-square bg-slate-900">
                      <img
                        src={img.url}
                        alt="Generated"
                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <button
                          onClick={() => downloadImage(img.url, `generated-${img.id}.png`)}
                          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                        >
                          ⬇️ Download
                        </button>
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      <p className="text-xs text-slate-400 line-clamp-2">{img.prompt}</p>
                      <p className="text-xs text-slate-500">{new Date(img.generatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FalImageGenerator;
