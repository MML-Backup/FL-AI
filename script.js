const OPENROUTER_API_KEY = "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"; // Replace with your actual API key
const HTTP_REFERER = "https://mml-backup.github.io/FL-AI/"; // Replace with your domain
const SITE_NAME = "FL AI"; // Your site name (using ASCII for headers)

// Define available models
// এখানে আপনি যত খুশি মডেল যোগ করতে পারেন OpenRouter ID সহ
// shortName অপশনাল, যদি আপনি UI তে নামের বদলে শর্ট নাম দেখাতে চান
const AVAILABLE_MODELS = [
  { id: "deepseek/deepseek-chat:free", name: "DeepSeek Chat Free", shortName: "DS" },
  { id: "google/gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash", shortName: "GF" },
  { id: "microsoft/phi-4-reasoning-plus:free", name: "Phi-4 Reasoning Plus", shortName: "P4+" },
  { id: "microsoft/phi-4-reasoning:free", name: "Phi-4 Reasoning", shortName: "P4" },
  { id: "meta-llama/llama-4-scout:free", name: "Llama 4 Scout", shortName: "L4S" },
  { id: "meta-llama/llama-4-maverick:free", name: "Llama 4 Maverick", shortName: "L4M" },
  { id: "google/gemma-2-9b-it:free", name: "Gemma 2 9B IT", shortName: "G2" },
  { id: "deepseek/deepseek-prover-v2:free", name: "DeepSeek Prover V2", shortName: "DSPV2" },
  { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B IT", shortName: "G3" } // নতুন মডেল যোগ করা হলো
];

let currentModelIndex = 0; // Start with the first model in the array
let CURRENT_MODEL = AVAILABLE_MODELS[currentModelIndex].id;
let CURRENT_MODEL_NAME = AVAILABLE_MODELS[currentModelIndex].name;


// Array to store chat history
// চ্যাট হিস্টরিতে মাল্টিমোডাল কন্টেন্ট সঠিক ফরম্যাটে সেভ করা হবে
const chatHistory = [];

// Function to switch models
function switchModel() {
    currentModelIndex = (currentModelIndex + 1) % AVAILABLE_MODELS.length;
    CURRENT_MODEL = AVAILABLE_MODELS[currentModelIndex].id;
    CURRENT_MODEL_NAME = AVAILABLE_MODELS[currentModelIndex].name;
    document.getElementById('modelSelector').textContent = CURRENT_MODEL_NAME;
    console.log("Switched model to:", CURRENT_MODEL_NAME, "(", CURRENT_MODEL, ")");

     // ঐচ্ছিকভাবে: মডেল পরিবর্তন করলে চ্যাট হিস্টরি রিসেট করতে পারেন
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
  // This is a basic example, a more robust solution would be needed for actual file uploads
  // The API call format requires a URL for images.
  const imageUrlRegex = /\bhttps?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)\b/i;
  const imageMatch = input.match(imageUrlRegex);

  if (imageMatch) {
      // Assume the input contains an image URL
      // Add image_url type part
      messageContent.push({
          "type": "image_url",
          "image_url": { "url": imageMatch[0] }
      });

      // Check if there's also text in the input
      const textPart = input.replace(imageMatch[0], '').trim();
      if (textPart) {
           messageContent.push({ "type": "text", "text": textPart });
           displayInput = textPart + " (Image attached)"; // Update display text
      } else {
           // If only an image URL is provided, add a default text instruction for the model
           // and update the display text
           const defaultText = "Analyze this image."; // Or a similar instruction
           messageContent.push({ "type": "text", "text": defaultText });
           displayInput = `Image: ${imageMatch[0]} (Instruction: ${defaultText})`; // Update display text
      }

  } else {
      // Treat as plain text input
      messageContent.push({ "type": "text", "text": input });
       displayInput = input; // Display the original text
  }


  // Add user message to chat history (displaying the formatted input)
  chatHistory.push({ role: "user", content: displayInput });
  updateChatHistory();

  // Clear input field
  inputElement.value = "";

  // Show loading indicator
  showLoadingIndicator();

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": HTTP_REFERER,
        "X-Title": SITE_NAME,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: CURRENT_MODEL, // Use the currently selected model
        // Send recent history + the current message
        // Adjust the history length as needed (e.g., .slice(-20) for last 10 turns)
        messages: [
           // Map chatHistory to the required API message format (role and content)
           // Note: This simplified mapping assumes history content is primarily text.
           // For complex multimodal history, you'd need a more sophisticated mapping.
           ...chatHistory.slice(-10).map(msg => ({
               role: msg.role,
               content: typeof msg.content === 'string' ? msg.content : msg.content.find(part => part.type === 'text')?.text || '' // Extract text from multimodal history for API
            })),
           { role: "user", content: messageContent } // Add the current multimodal user message
        ]
      })
    });

    const data = await res.json();
    const aiResponse = data.choices?.[0]?.message?.content || "No response received.";

    // Add AI response to chat history
    chatHistory.push({ role: "assistant", content: aiResponse });
    updateChatHistory();
  } catch (err) {
    console.error("API Error:", err); // Log the error for debugging
    chatHistory.push({ role: "assistant", content: "Error: Failed to get a response." }); // More user-friendly error
    updateChatHistory();
  } finally {
    // Hide loading indicator
    hideLoadingIndicator();
  }
}

// Function to update chat history display (unchanged)
function updateChatHistory() {
  const chatBox = document.getElementById("chatBox");
  chatBox.innerHTML = ""; // Clear previous chat history

  chatHistory.forEach((message) => {
    const messageDiv = document.createElement("div");
    messageDiv.className = message.role === "user" ? "user-message" : "ai-message";

    // Display the content. If it was a multimodal message, display the formatted displayInput.
    messageDiv.textContent = message.content;

    // If you want to display images sent by the user in the chat history:
    // You would need to check if the original input for this message contained an image URL
    // and create an <img> element. This requires storing more than just the displayInput in chatHistory.
    // Example (simplified - checking the displayInput string):
    // if (message.role === 'user' && typeof message.content === 'string' && message.content.startsWith('Image: http')) {
    //     const imageUrl = message.content.match(/\bhttps?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)\b/i)?.[0];
    //     if(imageUrl) {
    //         const imgElement = document.createElement('img');
    //         imgElement.src = imageUrl;
    //         imgElement.style.maxWidth = '200px'; // Limit image size in chat
    //         imgElement.style.display = 'block';
    //         imgElement.style.marginTop = '5px';
    //         // Prepend or append the image to the messageDiv
    //         // messageDiv.appendChild(imgElement);
    //     }
    // }


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

// Function to handle file upload
// IMPORTANT: This needs further implementation for images to get a URL or Base64
function uploadFile() {
  const fileInput = document.getElementById("fileUpload");
  const file = fileInput.files[0];
  if (file) {
     // The API call structure for images requires a URL (image_url type)
     // or potentially Base64 data (check OpenRouter/Model documentation for supported formats).

     // For image files, you would typically need to:
     // 1. Upload the file to a hosting service to get a public URL, OR
     // 2. Convert the image file to a Base64 data URL if the specific AI model supports it via OpenRouter.

     // The current implementation reads text files or provides a data URL for images,
     // but doesn't automatically integrate this into the API call format needed for images.

      if (file.type.startsWith('image/')) {
           console.warn("Image file upload requires conversion to URL or Base64 and integration into the API message format.");
           // Optional: Display a message to the user indicating they uploaded an image file
           document.getElementById("userInput").value = `Image file selected: ${file.name}. Please enter instruction or paste image URL if needed.`;
      } else if (file.type.startsWith('text/')) {
          const reader = new FileReader();
           reader.onload = async function (event) {
               const fileContent = event.target.result; // Text content
               // Optional: Display a message with file content in input or chat
                document.getElementById("userInput").value = `Text file selected: ${file.name}. Content snippet:\n\n${fileContent.substring(0, 200)}...`; // Show part of content
           };
           reader.readAsText(file);
      } else {
          console.warn("Unsupported file type for upload.");
          document.getElementById("userInput").value = `Unsupported file type selected: ${file.name}.`;
      }

      // Clear the file input after processing
      fileInput.value = '';
  }
}


// Voice recognition function (added console logs and robustness)
function startVoiceRecognition() {
  // Check for browser support
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      console.error("Speech Recognition API not supported in this browser.");
      chatHistory.push({ role: "assistant", content: "Voice input not supported in your browser." });
      updateChatHistory();
      return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.lang = "auto"; // Or try "bn-BD" for Bengali
  recognition.interimResults = false; // Only return final results
  recognition.maxAlternatives = 1; // Get only the most likely result

  recognition.onstart = () => {
    console.log("Voice recognition started.");
    // Check if the last message is already "Listening..." to avoid duplicates
    if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].content !== "Listening...") {
         chatHistory.push({ role: "assistant", content: "Listening..." });
         updateChatHistory();
    }
  };

  recognition.onresult = (event) => {
    console.log("Voice recognition result:", event.results);
    const transcript = event.results[0][0].transcript;
    document.getElementById("userInput").value = transcript;
    // Remove the "Listening..." message
     if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].content === "Listening...") {
        chatHistory.pop();
     }
    updateChatHistory(); // Update chat display to remove "Listening..."
    search(); // Trigger search after voice input
  };

  recognition.onerror = (event) => {
    console.error("Voice recognition error:", event.error);
     // Remove "Listening..." and add error message
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
    } // Add other error types as needed
    chatHistory.push({ role: "assistant", content: errorMessage });
    updateChatHistory();
  };

   recognition.onend = () => {
     console.log("Voice recognition ended.");
     // Ensure "Listening..." is removed if recognition ends for other reasons
     if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].content === "Listening...") {
        chatHistory.pop();
        updateChatHistory();
     }
   };

   // Start recognition
   try {
       recognition.start();
   } catch (error) {
       console.error("Error starting voice recognition:", error);
       chatHistory.push({ role: "assistant", content: "Could not start voice input. " + error.message });
       updateChatHistory();
   }
}


// Initialize icons and event listeners on window load
window.onload = () => {
  lucide.createIcons();

  // Update model selector button text initially
  document.getElementById('modelSelector').textContent = CURRENT_MODEL_NAME;

  // Add event listener for model selector button
  document.getElementById('modelSelector').addEventListener('click', switchModel);

  // Add event listener for voice input button
  document.getElementById("voiceIcon").addEventListener("click", startVoiceRecognition);

  // Add event listener for input field keypress (Enter key)
  document.getElementById("userInput").addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent default form submission if inside a form
      search();
    }
  });

  // Add event listener for file input change
  document.getElementById("fileUpload").addEventListener("change", uploadFile);

  console.log("App initialized. Current model:", CURRENT_MODEL_NAME);
};
