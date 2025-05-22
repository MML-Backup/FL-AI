// api/chat.js
const fetch = require('node-fetch'); // For Node.js environments

export default async function handler(req, res) {
  console.log('Received request with method:', req.method);

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const Google Search_API_KEY = process.env.Google Search_API_KEY; // Your Google Search API Key
  const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID; // Your Google Custom Search Engine ID

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "OpenRouter API Key not configured in backend." });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ body: 'Method Not Allowed' });
  }

  try {
    const requestBody = req.body;
    // Get the latest user text content from the last message in the array
    const lastUserMessage = requestBody.messages[requestBody.messages.length - 1];
    let userTextContent = "";

    // Extract text from the last user message, which can be an array of parts
    if (Array.isArray(lastUserMessage.content)) {
        const textPart = lastUserMessage.content.find(part => part.type === 'text');
        if (textPart) {
            userTextContent = textPart.text;
        }
    } else if (typeof lastUserMessage.content === 'string') {
        userTextContent = lastUserMessage.content; // Fallback for plain string content
    }

    // --- TOOLING: Deep Research (Google Search Integration) ---
    const Google Search = async (query) => {
        if (!Google Search_API_KEY || !GOOGLE_CSE_ID) {
            console.warn("Google Search API keys are not configured. Deep Research will be simulated.");
            return JSON.stringify({ tool_response: "Google Search API keys are not configured. Cannot perform real-time search. Please add Google Search_API_KEY and GOOGLE_CSE_ID to your Vercel environment variables." });
        }
        
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${Google Search_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}`;
        try {
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();

            if (searchData.error) {
                console.error("Google Search API error:", searchData.error);
                return JSON.stringify({ tool_response: `Error performing search: ${searchData.error.message}` });
            }

            if (searchData.items && searchData.items.length > 0) {
                // Extract relevant snippets
                const snippets = searchData.items.slice(0, 3).map(item => ({
                    title: item.title,
                    link: item.link,
                    snippet: item.snippet
                }));
                console.log("Google Search results:", snippets);
                return JSON.stringify({ tool_response: "Search successful. Relevant snippets provided:", snippets });
            } else {
                return JSON.stringify({ tool_response: "No search results found for the query." });
            }
        } catch (searchError) {
            console.error("Failed to fetch from Google Search API:", searchError);
            return JSON.stringify({ tool_response: `Failed to perform search due to network or API error: ${searchError.message}` });
        }
    };

    // Simple intent detection for "deep research"
    if (userTextContent && (userTextContent.toLowerCase().includes("research") || userTextContent.toLowerCase().includes("latest info on") || userTextContent.toLowerCase().includes("what is the current status of"))) {
        const researchQuery = userTextContent.replace(/research|latest info on|what is the current status of/i, '').trim();
        if (researchQuery) {
            const searchResult = await Google Search(researchQuery);
            // Append search result as a tool output message
            requestBody.messages.push({
                role: "tool",
                content: [{ type: "text", text: `Tool output for 'Google Search("${researchQuery}")': ${searchResult}` }]
            });
            // Add a system message to guide the AI to use this research
            requestBody.messages.push({
                role: "system",
                content: [{ type: "text", text: "Based on the provided search results, answer the user's question. If no results, explain." }]
            });
            console.log("Deep Research triggered and search results added to messages.");
        }
    }


    // --- Image Generation Logic ---
    if (userTextContent && (userTextContent.toLowerCase().includes("generate image of") || userTextContent.toLowerCase().includes("create a picture of"))) {
        try {
            const promptForImage = userTextContent.replace(/generate image of|create a picture of/i, '').trim();
            if (!promptForImage) {
                return res.status(400).json({ error: "Please provide a description for the image to generate." });
            }

            console.log("Attempting to generate image with prompt:", promptForImage);

            const dalleRes = await fetch("https://openrouter.ai/api/v1/images/generations", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "HTTP-Referer": process.env.VERCEL_URL || 'YOUR_SITE_URL', // Replace 'YOUR_SITE_URL'
                    "X-Title": "FL AI Vercel Backend (Image Gen)",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: promptForImage,
                    model: "dall-e-3", // Using DALL-E 3 for high quality. Check OpenRouter for other models.
                    n: 1,
                    size: "1024x1024"
                }),
            });

            const dalleData = await dalleRes.json();
            console.log("DALL-E response:", dalleData);

            if (!dalleRes.ok || !dalleData.data || dalleData.data.length === 0) {
                const errorMessage = dalleData.error?.message || "Failed to generate image.";
                return res.status(dalleRes.status || 500).json({ error: errorMessage });
            }

            const imageUrl = dalleData.data[0].url;
            return res.status(200).json({ response: `Here is your image: <br><img src="${imageUrl}" style="max-width:100%; border-radius:8px; margin-top:10px;" alt="Generated Image">` });

        } catch (imageGenError) {
            console.error("Error during image generation:", imageGenError);
            return res.status(500).json({ error: `Image generation failed: ${imageGenError.message}` });
        }
    }

    // --- Regular Chat Completion Logic ---
    const openRouterPayload = {
      model: requestBody.model || "google/gemini-2.5-flash-preview-04-17",
      messages: requestBody.messages,
    };

    const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.VERCEL_URL || 'YOUR_SITE_URL', // Replace 'YOUR_SITE_URL'
        "X-Title": "FL AI Vercel Backend",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openRouterPayload),
    });

    const openRouterData = await openRouterRes.json();

    if (!openRouterRes.ok) {
        console.error("OpenRouter API error:", openRouterData);
        return res.status(openRouterRes.status).json(openRouterData);
    }

    res.status(200).json({ response: openRouterData.choices?.[0]?.message?.content || "No response from AI." });

  } catch (error) {
    console.error("Backend Function Error:", error);
    res.status(500).json({ error: `Backend processing error: ${error.message}` });
  }
}
