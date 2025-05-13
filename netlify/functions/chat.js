// netlify/functions/chat.js
const fetch = require('node-fetch'); // node-fetch লাইব্রেরিটি Node.js এ fetch ব্যবহারের জন্য দরকার হতে পারে

exports.handler = async function(event, context) {
  // API Key টি Netlify Environment Variables থেকে নিরাপদে পড়ুন
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const SITE_REFERER = process.env.YOUR_SITE_URL; // Netlify বা আপনার সাইটের URL

  // API Key না থাকলে এরর দিন
  if (!OPENROUTER_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API Key not configured in backend." })
    };
  }

  // শুধুমাত্র POST রিকোয়েস্ট হ্যান্ডেল করুন
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Frontend থেকে পাঠানো ডেটা (messages, model ইত্যাদি) নিন
    const requestBody = JSON.parse(event.body);

    // OpenRouter API এর জন্য পেলোড তৈরি করুন
    const openRouterPayload = {
      model: requestBody.model || "google/gemini-2.5-flash-preview-04-17", // Frontend থেকে মডেল নিন অথবা Default ব্যবহার করুন
      messages: requestBody.messages, // Frontend থেকে আসা মেসেজ নিন
      // OpenRouter এর অন্যান্য Parameters এখানে যোগ করতে পারেন, যেমন temperature, max_tokens ইত্যাদি
    };

    // OpenRouter API কে কল করুন (এখানেই API Key ব্যবহৃত হবে, যা Public হচ্ছে না)
    const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`, // <--- API Key এখানে ব্যবহৃত হচ্ছে
        "HTTP-Referer": SITE_REFERER, // আপনার সাইটের URL
        "X-Title": "FL AI Backend", // Backend থেকে কল হচ্ছে বোঝানোর জন্য
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openRouterPayload),
    });

    const openRouterData = await openRouterRes.json();

    // OpenRouter থেকে যদি এরর আসে, সেটি Frontend এ ফেরত পাঠান
    if (!openRouterRes.ok) {
         return {
           statusCode: openRouterRes.status,
           body: JSON.stringify(openRouterData) // OpenRouter এরর Format
         };
    }

    // OpenRouter থেকে সফল উত্তর পেলে সেটি Frontend এ ফেরত পাঠান
    return {
      statusCode: 200,
      body: JSON.stringify({ response: openRouterData.choices?.[0]?.message?.content || "No response from AI." }),
    };

  } catch (error) {
    console.error("Backend Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Backend processing error: ${error.message}` }),
    };
  }
};