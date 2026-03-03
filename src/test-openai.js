require('dotenv').config();

async function testDiscover() {
  const normalizedWebsiteUrl = 'https://www.postquee.com';
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("No API Key");
    return;
  }
  
  try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return strict JSON only: {"apiBaseUrl": string|null, "authScheme": "Bearer"|"Basic"|"ApiKey"|"OAuth2"|"unknown", "confidence": number, "notes": string}. Never include secrets.' },
            { role: 'user', content: `Website URL: ${normalizedWebsiteUrl}. Infer likely public API base URL and auth scheme.` }
          ]
        })
      });

      const data = await resp.json();
      console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
testDiscover();