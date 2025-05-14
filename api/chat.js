// api/chat.js
// Vercel Functions Node.js Runtime এ সাধারণত global fetch পাওয়া যায়, node-fetch require নাও লাগতে পারে
// তবে package.json এ dependency যেহেতু আছে, রাখলে ক্ষতি নেই
const fetch = require('node-fetch');

// এই ফাংশনটি Vercel Functions এ API endpoint হিসেবে কাজ করবে
export default async function handler(req, res) {
  // --- এই লাইনটি যোগ করুন ---
  console.log('Received request with method:', req.method);
  // --------------------------

  // API Key টি Vercel Environment Variables থেকে নিরাপদে পড়ুন
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  // API Key না থাকলে এরর দিন
  if (!OPENROUTER_API_KEY) {
    res.status(500).json({ error: "API Key not configured in backend." });
    return;
  }

  // শুধুমাত্র POST রিকোয়েস্ট হ্যান্ডেল করুন
  if (req.method !== 'POST') {
    res.status(405).json({ body: 'Method Not Allowed' });
    return;
  }

  try {
    // Frontend থেকে পাঠানো ডেটা (messages, model ইত্যাদি) নিন
    // Vercel Functions req.body তে JSON ডেটা অটোমেটিক্যালি পার্স করে দেয়
    const requestBody = req.body;

    // OpenRouter API এর জন্য পেলোড তৈরি করুন
    const openRouterPayload = {
      model: requestBody.model || "google/gemini-2.5-flash-preview-04-17", // Frontend থেকে মডেল নিন অথবা Default ব্যবহার করুন
      messages: requestBody.messages, // Frontend থেকে আসা মেসেজ নিন
      // OpenRouter এর অন্যান্য Parameters এখানে যোগ করতে পারেন, যেমন temperature, max_tokens ইত্যাদি
    };

    // OpenRouter API কে কল করুন (এখানেই API Key ব্যবহৃত হবে, যা Public হচ্ছে না)
    const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", { // <-- নিশ্চিত করুন URL টি ঠিক আছে
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`, // <--- API Key এখানে ব্যবহৃত হচ্ছে
        "HTTP-Referer": process.env.VERCEL_URL || process.env.YOUR_SITE_URL || 'YOUR_SITE_URL', // Vercel এর built-in URL variable ব্যবহার করুন অথবা আপনার Vercel সাইটের URL দিন
        "X-Title": "FL AI Vercel Backend", // Backend থেকে কল হচ্ছে বোঝানোর জন্য
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openRouterPayload),
    });

    const openRouterData = await openRouterRes.json();

    // OpenRouter থেকে যদি এরর আসে, সেটি Frontend এ ফেরত পাঠান
    if (!openRouterRes.ok) {
         res.status(openRouterRes.status).json(openRouterData); // OpenRouter এরর Format
         return;
    }

    // OpenRouter থেকে সফল উত্তর পেলে সেটি Frontend এ ফেরত পাঠান
    res.status(200).json({ response: openRouterData.choices?.[0]?.message?.content || "No response from AI." });

  } catch (error) {
    console.error("Backend Function Error:", error);
    res.status(500).json({ error: `Backend processing error: ${error.message}` });
  }
}
