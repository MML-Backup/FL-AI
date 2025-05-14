// script.js



// --- START: Removed hardcoded sensitive information ---

// REMOVED: const OPENROUTER_API_KEY = "...";

// REMOVED: const HTTP_REFERER = "...";

// REMOVED: const SITE_NAME = "...";

// এই তথ্যগুলো এখন Vercel Environment Variables থেকে Backend Function দ্বারা ব্যবহার হবে।

// --- END: Removed hardcoded sensitive information ---





// Define available models (UI তে মডেল দেখানোর জন্য এই অ্যারে এখানেই থাকবে)

const AVAILABLE_MODELS = [

  { id: "deepseek/deepseek-chat:free", name: "DeepSeek Chat Free", shortName: "DS" },

  { id: "google/gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash", shortName: "GF" },

  { id: "microsoft/phi-4-reasoning-plus:free", name: "Phi-4 Reasoning Plus", shortName: "P4+" },

  { id: "microsoft/phi-4-reasoning:free", name: "Phi-4 Reasoning", shortName: "P4" },

  { id: "meta-llama/llama-4-scout:free", name: "Llama 4 Scout", shortName: "L4S" },

  { id: "meta-llama/llama-4-maverick:free", name: "Llama 4 Maverick", shortName: "L4M" },

  { id: "google/gemma-2-9b-it:free", name: "Gemma 2 9B IT", shortName: "G2" },

  { id: "deepseek/deepseek-prover-v2:free", name: "DeepSeek Prover V2", shortName: "DSPV2" },

  { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B IT", shortName: "G3" }

];



let currentModelIndex = 0; // Start with the first model in the array

let CURRENT_MODEL = AVAILABLE_MODELS[currentModelIndex].id;

let CURRENT_MODEL_NAME = AVAILABLE_MODELS[currentModelIndex].name;





// Array to store chat history

const chatHistory = [];



// Function to switch models (আগের মতোই থাকবে)

function switchModel() {

    currentModelIndex = (currentModelIndex + 1) % AVAILABLE_MODELS.length;

    CURRENT_MODEL = AVAILABLE_MODELS[currentModelIndex].id;

    CURRENT_MODEL_NAME = AVAILABLE_MODELS[currentModelIndex].name;

    document.getElementById('modelSelector').textContent = CURRENT_MODEL_NAME;

    console.log("Switched model to:", CURRENT_MODEL_NAME, "(", CURRENT_MODEL, ")");



     // Optional: Reset chat history on model switch if desired

     // chatHistory.length = 0;

     // updateChatHistory();

}



// Function to handle user input and send to API

async function search() {

  const inputElement = document.getElementById("userInput");

  const input = inputElement.value.trim();

  const chatBox = document.getElementById("chatBox");

  if (!input) return;



  // Determine message content based on input type (text or image URL)

  let messageContent = [];

  let displayInput = input; // What to display in the chat box



  // Simple check if input looks like an image URL

  const imageUrlRegex = /\bhttps?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)\b/i;

  const imageMatch = input.match(imageUrlRegex);



  if (imageMatch) {

      messageContent.push({

          "type": "image_url",

          "image_url": { "url": imageMatch[0] }

      });



      const textPart = input.replace(imageMatch[0], '').trim();

      if (textPart) {

           messageContent.push({ "type": "text", "text": textPart });

           displayInput = textPart + " (Image attached)";

      } else {

           const defaultText = "Analyze this image.";

           messageContent.push({ "type": "text", "text": defaultText });

           displayInput = `Image: ${imageMatch[0]} (Instruction: ${defaultText})`;

      }



  } else {

      messageContent.push({ "type": "text", "text": input });

       displayInput = input;

  }



  // Add user message to chat history (displaying the formatted input)

  chatHistory.push({ role: "user", content: displayInput });

  updateChatHistory();



  // Clear input field

  inputElement.value = "";



  // Show loading indicator

  showLoadingIndicator();



  try {

    // *** CHANGE: Fetch URL now points to the Vercel backend function endpoint ***

    // *** Remove sensitive headers (Authorization, HTTP-Referer, X-Title) ***

    const res = await fetch("/api/chat", { // <-- Vercel Function Endpoint (automatically available relative URL)

      method: "POST",

      headers: {

        "Content-Type": "application/json"

        // API Key, Referer, X-Title are handled securely by the backend function

      },

      body: JSON.stringify({

        model: CURRENT_MODEL, // Send the selected model ID to the backend

        // Send recent history + the current message content to the backend

        messages: [

           // Map chatHistory to the required API message format (role and content)

           // Ensure multimodal content is sent correctly

             ...chatHistory.slice(-10).map(msg => ({

                 role: msg.role,

                 // If content is a string, convert it to the array format [{ type: 'text', text: '...' }]

                 // If content is already an array (from multimodal input), send it as is

                 content: typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : msg.content

             })),

           { role: "user", content: messageContent } // Add the current multimodal user message content

        ]

      })

    });



    // *** CHANGE: Handle response from our backend function ***

    // Our backend function returns a JSON object like { response: "AI message" } or { error: "..." }

    const data = await res.json();



    // Check if the backend returned an error (e.g., API key missing, OpenRouter error)

    if (!res.ok) {

        const errorMessage = data.error || "Unknown error from backend.";

        throw new Error(`Backend responded with status ${res.status}: ${errorMessage}`);

    }



    // Get the AI response from the backend's response object

    const aiResponse = data.response || "No response received from backend.";



    // Add AI response to chat history

    chatHistory.push({ role: "assistant", content: aiResponse });

    updateChatHistory();

  } catch (err) {

    console.error("Backend Function Call Error:", err); // Log the error for debugging

    chatHistory.push({ role: "assistant", content: `Error: Failed to get a response from backend. ${err.message}` }); // More user-friendly error

    updateChatHistory();

  } finally {

    // Hide loading indicator

    hideLoadingIndicator();

  }

}



// Function to update chat history display (unchanged - displays simple string content)

function updateChatHistory() {

  const chatBox = document.getElementById("chatBox");

  chatBox.innerHTML = ""; // Clear previous chat history



  chatHistory.forEach((message) => {

    const messageDiv = document.createElement("div");

    messageDiv.className = message.role === "user" ? "user-message" : "ai-message";



    // Display the content - it should be a string at this point

    messageDiv.innerHTML = message.content; // Use innerHTML to render basic formatting if any



    chatBox.appendChild(messageDiv);

  });



  // Scroll to the bottom of the chat box

  chatBox.scrollTop = chatBox.scrollHeight;

}





// Function to show loading indicator (unchanged)

function showLoadingIndicator() {

  const chatBox = document.getElementById("chatBox");

  // Remove any existing loading indicator before adding a new one

  hideLoadingIndicator();



  const loadingDiv = document.createElement("div");

  loadingDiv.id = "loadingIndicator";

  loadingDiv.className = "ai-message"; // Style like an AI message

  loadingDiv.innerHTML = `<div class="loading-spinner"></div> Processing...`;

  chatBox.appendChild(loadingDiv);



  // Scroll to the bottom

  chatBox.scrollTop = chatBox.scrollHeight;

}



// Function to hide loading indicator (unchanged)

function hideLoadingIndicator() {

  const loadingDiv = document.getElementById("loadingIndicator");

  if (loadingDiv) {

    loadingDiv.remove();

  }

}



// Function to handle file upload (needs further implementation to get URL/Base64 for images)

function uploadFile() {

  const fileInput = document.getElementById("fileUpload");

  const file = fileInput.files[0];

  if (file) {

      if (file.type.startsWith('image/')) {

           console.warn("Image file upload requires conversion to URL or Base64 and integration into the API message format.");

           document.getElementById("userInput").value = `Image file selected: ${file.name}. Please enter instruction or paste image URL if needed.`;

      } else if (file.type.startsWith('text/')) {

          const reader = new FileReader();

           reader.onload = async function (event) {

               const fileContent = event.target.result; // Text content

                document.getElementById("userInput").value = `Text file selected: ${file.name}. Content snippet:\n\n${fileContent.substring(0, 200)}...`; // Show part of content

           };

           reader.readAsText(file);

      } else {

          console.warn("Unsupported file type for upload.");

          document.getElementById("userInput").value = `Unsupported file type selected: ${file.name}.`;

      }



      fileInput.value = ''; // Clear the file input

  }

}





// Voice recognition function (unchanged)

function startVoiceRecognition() {

  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {

      console.error("Speech Recognition API not supported in this browser.");

      chatHistory.push({ role: "assistant", content: "Voice input not supported in your browser." });

      updateChatHistory();

      return;

  }



  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const recognition = new SpeechRecognition();



  recognition.lang = "auto"; // Or try "bn-BD" for Bengali

  recognition.interimResults = false;

  recognition.maxAlternatives = 1;



  recognition.onstart = () => {

    console.log("Voice recognition started.");

    if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].content !== "Listening...") {

         chatHistory.push({ role: "assistant", content: "Listening..." });

         updateChatHistory();

    }

  };



  recognition.onresult = (event) => {

    console.log("Voice recognition result:", event.results);

    const transcript = event.results[0][0].transcript;

    document.getElementById("userInput").value = transcript;

     if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].content === "Listening...") {

        chatHistory.pop();

     }

    updateChatHistory();

    search();

  };



  recognition.onerror = (event) => {

    console.error("Voice recognition error:", event.error);

     if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].content === "Listening...") {

        chatHistory.pop();

     }

    let errorMessage = "Voice input error.";

    if (event.error === 'no-speech') {

        errorMessage = "No speech detected.";

    } else if (event.error === 'not-allowed') {

         errorMessage = "Microphone permission denied. Please allow microphone access in your browser settings.";

    } else if (event.error === 'service-not-allowed') {

         errorMessage = "Microphone permission denied by the system or browser security policy.";

    }

    chatHistory.push({ role: "assistant", content: errorMessage });

    updateChatHistory();

  };



   recognition.onend = () => {

     console.log("Voice recognition ended.");

     if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].content === "Listening...") {

        chatHistory.pop();

        updateChatHistory();

     }

   };



   try {

       recognition.start();

   } catch (error) {

       console.error("Error starting voice recognition:", error);

       chatHistory.push({ role: "assistant", content: "Could not start voice input. " + error.message });

       updateChatHistory();

   }

}





// Initialize icons and event listeners on window load (unchanged)

window.onload = () => {

  lucide.createIcons();



  document.getElementById('modelSelector').textContent = CURRENT_MODEL_NAME;

  document.getElementById('modelSelector').addEventListener('click', switchModel);

  document.getElementById("voiceIcon").addEventListener("click", startVoiceRecognition);



  document.getElementById("userInput").addEventListener("keypress", (event) => {

    if (event.key === "Enter") {

      event.preventDefault();

      search();

    }

  });



  document.getElementById("fileUpload").addEventListener("change", uploadFile);



  console.log("App initialized. Current model:", CURRENT_MODEL_NAME);

};







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
