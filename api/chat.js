// api/chat.js
const fetch = require('node-fetch'); // For Node.js environments

export default async function handler(req, res) {
  console.log('Received request with method:', req.method);

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  // For Deep Research, you might need a Google Custom Search API Key or Brave Search API Key
  // const Google Search_API_KEY = process.env.Google Search_API_KEY;
  // const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

  if (!OPENROUTER_API_KEY) {
    res.status(500).json({ error: "API Key not configured in backend." });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ body: 'Method Not Allowed' });
    return;
  }

  try {
    const requestBody = req.body;
    const userMessageContent = requestBody.messages[requestBody.messages.length - 1]?.content?.[0]?.text; // Get the latest user text message


    // --- TOOLING: Deep Research (Google Search Placeholder) ---
    // This is a simplified example. A full implementation would involve:
    // 1. More sophisticated intent detection for "deep research" queries.
    // 2. Actual API calls to a search engine (Google CSE, Brave Search, etc.).
    // 3. Parsing search results and feeding relevant snippets to the LLM.
    const Google Search = async (query) => {
        console.log("Simulating Google Search for:", query);
        // Implement actual Google Search API call here
        // Example with placeholder:
        // const searchRes = await fetch(`https://www.googleapis.com/customsearch/v1?key=${Google Search_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}`);
        // const searchData = await searchRes.json();
        // return JSON.stringify(searchData.items?.map(item => ({ title: item.title, link: item.link, snippet: item.snippet })) || []);

        return `{"tool_response": "Successfully performed a simulated search for '${query}'. (Actual search functionality requires API key and implementation). Relevant info would be processed here."}`;
    };

    // Add a simple check for deep research intent
    // This is a basic keyword check; for production, use an LLM for tool calling
    if (userMessageContent && userMessageContent.toLowerCase().includes("research") || userMessageContent.toLowerCase().includes("latest info on")) {
        const researchQuery = userMessageContent.replace(/research|latest info on/i, '').trim();
        if (researchQuery) {
            const searchResult = await Google Search(researchQuery);
            // Append search result to messages to guide the AI
            requestBody.messages.push({
                role: "tool",
                content: [{ type: "text", text: `Search results for "${researchQuery}": ${searchResult}` }]
            });
            // You might want to add a system message to guide the AI to use this research
            requestBody.messages.push({
                role: "system",
                content: [{ type: "text", text: "Based on the provided search results, answer the user's question." }]
            });
            console.log("Deep Research triggered and added to messages.");
        }
    }


    // --- Image Generation Logic ---
    // Check if the user's prompt suggests image generation
    if (userMessageContent && (userMessageContent.toLowerCase().includes("generate image of") || userMessageContent.toLowerCase().includes("create a picture of"))) {
        try {
            const promptForImage = userMessageContent.replace(/generate image of|create a picture of/i, '').trim();
            if (!promptForImage) {
                return res.status(400).json({ error: "Please provide a description for the image to generate." });
            }

            console.log("Attempting to generate image with prompt:", promptForImage);

            const dalleRes = await fetch("https://openrouter.ai/api/v1/images/generations", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "HTTP-Referer": process.env.VERCEL_URL || 'YOUR_SITE_URL', // Replace 'YOUR_SITE_URL' with your actual site URL
                    "X-Title": "FL AI Vercel Backend (Image Gen)",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: promptForImage,
                    model: "dall-e-3", // Or another supported OpenRouter image model like "stable-diffusion"
                    n: 1, // Number of images to generate
                    size: "1024x1024" // Image size
                }),
            });

            const dalleData = await dalleRes.json();
            console.log("DALL-E response:", dalleData);

            if (!dalleRes.ok || !dalleData.data || dalleData.data.length === 0) {
                const errorMessage = dalleData.error?.message || "Failed to generate image.";
                return res.status(dalleRes.status || 500).json({ error: errorMessage });
            }

            const imageUrl = dalleData.data[0].url;
            // Return HTML directly to be rendered by Marked in frontend
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
        "HTTP-Referer": process.env.VERCEL_URL || 'YOUR_SITE_URL', // Replace 'YOUR_SITE_URL' with your actual site URL
        "X-Title": "FL AI Vercel Backend",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openRouterPayload),
    });

    const openRouterData = await openRouterRes.json();

    if (!openRouterRes.ok) {
        return res.status(openRouterRes.status).json(openRouterData);
    }

    res.status(200).json({ response: openRouterData.choices?.[0]?.message?.content || "No response from AI." });

  } catch (error) {
    console.error("Backend Function Error:", error);
    res.status(500).json({ error: `Backend processing error: ${error.message}` });
  }
}
