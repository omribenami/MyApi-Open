/**
 * FAL Image Generation Routes
 * Provides REST API endpoints for generating images using FAL models
 * Supports SDXL, Flux, and other models via FAL's serverless GPU platform
 */

const express = require('express');
const router = express.Router();
const { getServicePreferences, storeServicePreferences } = require('../database');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/**
 * POST /api/v1/fal/generate
 * Generate an image using FAL models
 */
router.post('/generate', async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.tokenMeta?.ownerId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { prompt, model = 'fal-ai/fast-sdxl', negative_prompt = '', num_images = 1, guidance_scale = 7.5, num_inference_steps = 25 } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get FAL API key from service preferences
    const prefs = getServicePreferences('fal', userId);
    let falApiKey = null;

    if (prefs?.preferences?.fal_api_key) {
      falApiKey = prefs.preferences.fal_api_key;
    } else if (prefs?.preferences?.api_key) {
      falApiKey = prefs.preferences.api_key;
    } else {
      falApiKey = process.env.FAL_API_KEY;
    }

    if (!falApiKey) {
      return res.status(403).json({ 
        error: 'FAL API key not configured. Add it in service preferences or set FAL_API_KEY environment variable.' 
      });
    }

    console.log(`[FAL] Generating image with model: ${model}`);

    // Call FAL API
    const falResponse = await fetch('https://api.fal.ai/v1/models/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_name: model,
        input: {
          prompt,
          negative_prompt,
          num_images: Math.min(num_images, 4), // Limit to 4 images
          guidance_scale: Math.max(1, Math.min(20, guidance_scale)),
          num_inference_steps: Math.max(1, Math.min(100, num_inference_steps))
        }
      })
    });

    if (!falResponse.ok) {
      const error = await falResponse.text();
      console.error('[FAL] API Error:', error);
      return res.status(falResponse.status).json({ 
        error: `FAL API error: ${falResponse.status}`,
        details: error 
      });
    }

    const submitData = await falResponse.json();
    const requestId = submitData.request_id;

    console.log(`[FAL] Generation submitted, request_id: ${requestId}`);

    // Poll for result (with timeout)
    const maxAttempts = 120; // 2 minutes with 1s polling
    let attempts = 0;
    let result = null;

    while (attempts < maxAttempts) {
      const pollResponse = await fetch(`https://api.fal.ai/v1/requests/${requestId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Key ${falApiKey}`
        }
      });

      if (!pollResponse.ok) {
        console.error('[FAL] Poll error:', pollResponse.status);
        return res.status(pollResponse.status).json({ error: 'Failed to check generation status' });
      }

      const pollData = await pollResponse.json();

      if (pollData.status === 'COMPLETED') {
        result = pollData;
        break;
      } else if (pollData.status === 'FAILED') {
        console.error('[FAL] Generation failed:', pollData);
        return res.status(500).json({ 
          error: 'Image generation failed',
          details: pollData.error || 'Unknown error'
        });
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!result) {
      return res.status(408).json({ error: 'Image generation timeout. Please try again.' });
    }

    console.log(`[FAL] ✅ Generation completed in ${attempts}s`);

    return res.json({
      success: true,
      requestId,
      data: result.output || result,
      model,
      prompt,
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('[FAL] Error:', err);
    return res.status(500).json({ 
      error: 'Failed to generate image'
    });
  }
});

/**
 * GET /api/v1/fal/models
 * List available FAL models for image generation
 */
router.get('/models', (req, res) => {
  const models = [
    {
      id: 'fal-ai/fast-sdxl',
      name: 'SDXL Fast',
      description: 'Fast Stable Diffusion XL - Good balance of speed and quality',
      category: 'diffusion',
      avgGenerationTime: '10-15s',
      maxImages: 4,
      supportsNegativePrompt: true,
      recommended: true
    },
    {
      id: 'fal-ai/sdxl',
      name: 'SDXL Standard',
      description: 'Standard Stable Diffusion XL - Higher quality but slower',
      category: 'diffusion',
      avgGenerationTime: '20-30s',
      maxImages: 4,
      supportsNegativePrompt: true
    },
    {
      id: 'fal-ai/flux/dev',
      name: 'Flux Dev',
      description: 'Flux development model - High quality, good balance',
      category: 'diffusion',
      avgGenerationTime: '15-20s',
      maxImages: 2,
      supportsNegativePrompt: false,
      new: true
    },
    {
      id: 'fal-ai/flux/pro',
      name: 'Flux Pro',
      description: 'Flux pro model - Highest quality (may require premium)',
      category: 'diffusion',
      avgGenerationTime: '25-35s',
      maxImages: 1,
      supportsNegativePrompt: false,
      premium: true
    },
    {
      id: 'fal-ai/photoshop',
      name: 'Photoshop Generative',
      description: 'Photoshop-style generative fill',
      category: 'inpainting',
      avgGenerationTime: '10-15s',
      maxImages: 1,
      supportsNegativePrompt: true
    }
  ];

  return res.json({ 
    success: true,
    data: models,
    count: models.length
  });
});

/**
 * POST /api/v1/fal/upscale
 * Upscale an existing image
 */
router.post('/upscale', async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.tokenMeta?.ownerId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { imageUrl, scaleFactor = 4 } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const prefs = getServicePreferences('fal', userId);
    let falApiKey = prefs?.preferences?.fal_api_key || prefs?.preferences?.api_key || process.env.FAL_API_KEY;

    if (!falApiKey) {
      return res.status(403).json({ error: 'FAL API key not configured' });
    }

    console.log(`[FAL] Upscaling image: ${imageUrl}`);

    const falResponse = await fetch('https://api.fal.ai/v1/models/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_name: 'fal-ai/upscayl',
        input: {
          image_url: imageUrl,
          scale: Math.max(2, Math.min(4, scaleFactor))
        }
      })
    });

    if (!falResponse.ok) {
      return res.status(falResponse.status).json({ error: 'FAL API error' });
    }

    const data = await falResponse.json();

    return res.json({
      success: true,
      requestId: data.request_id,
      data
    });

  } catch (err) {
    console.error('[FAL] Upscale error:', err);
    return res.status(500).json({ error: 'Failed to upscale image' });
  }
});

/**
 * POST /api/v1/fal/test
 * Test FAL API connectivity
 */
router.post('/test', async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.tokenMeta?.ownerId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const prefs = getServicePreferences('fal', userId);
    let falApiKey = prefs?.preferences?.fal_api_key || prefs?.preferences?.api_key || process.env.FAL_API_KEY;

    if (!falApiKey) {
      return res.status(403).json({ 
        error: 'FAL API key not configured',
        needsSetup: true
      });
    }

    // Try to list models as a connectivity test
    const testResponse = await fetch('https://api.fal.ai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Key ${falApiKey}`
      }
    });

    if (!testResponse.ok) {
      return res.status(testResponse.status).json({ 
        error: 'FAL API test failed',
        status: testResponse.status 
      });
    }

    return res.json({
      success: true,
      message: 'FAL API is configured and working correctly',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[FAL] Test error:', err);
    return res.status(500).json({ 
      error: 'Failed to test FAL API'
    });
  }
});

module.exports = router;
