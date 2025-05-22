// --- START: Removed hardcoded sensitive information ---
// const OPENROUTER_API_KEY = "...";
// const HTTP_REFERER = "...";
// const SITE_NAME = "...";
// These are now securely handled in backend via Vercel Environment Variables
// --- END ---

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

let currentModelIndex = 0;
let CURRENT_MODEL = AVAILABLE_MODELS[currentModelIndex].id;
let CURRENT_MODEL_NAME = AVAILABLE_MODELS[currentModelIndex].name;

const chatHistory = []; // Stores objects like { role: "user", content: "..." } or { role: "assistant", content: "..." }

function switchModel() {
  currentModelIndex = (currentModelIndex + 1) % AVAILABLE_MODELS.length;
  CURRENT_MODEL = AVAILABLE_MODELS[currentModelIndex].id;
  CURRENT_MODEL_NAME = AVAILABLE_MODELS[currentModelIndex].name;
  document.getElementById('modelSelector').textContent = AVAILABLE_MODELS[currentModelIndex].shortName; // Show short name
  console.log("Switched model to:", CURRENT_MODEL_NAME);
}

// Function to start a new chat (clears history and UI)
function startNewChat() {
    chatHistory.length = 0; // Clear the array
    updateChatHistory(); // Update UI
    // Show the initial message
    const chatBox = document.getElementById("chatBox");
    chatBox.innerHTML = `
        <div class="initial-message">
            <div class="title">ᖴᒪ.ᗩI</div>
            <div class="subtitle">Your AI Companion</div>
            <p>How can I help you today?</p>
        </div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Function to handle sending messages
async function search() {
  const inputElement = document.getElementById("userInput");
  const input = inputElement.value.trim();
  if (!input) return;

  // Remove initial message if present
  const initialMessageDiv = document.querySelector('.initial-message');
  if (initialMessageDiv) {
      initialMessageDiv.remove();
  }

  let messageContent = [];
  let displayInput = input;
  const imageUrlRegex = /\bhttps?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)\b/i;
  const imageMatch = input.match(imageUrlRegex);

  // Check if the input starts with a file instruction (from uploadFile)
  const isFileUploadInstruction = input.startsWith("Image selected:") || input.startsWith("Text file selected:") || input.startsWith("PDF selected:") || input.startsWith("Video selected:");

  if (imageMatch) {
    // If a direct image URL is pasted in input
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
  } else if (isFileUploadInstruction) {
    // If a file was uploaded and instruction set by uploadFile
    // For now, we'll just pass the instruction as text.
    // Full file content handling needs backend changes.
    messageContent.push({ "type": "text", "text": input });
    displayInput = input;
  }
  else {
    // Regular text input
    messageContent.push({ "type": "text", "text": input });
    displayInput = input;
  }

  chatHistory.push({ role: "user", content: displayInput });
  updateChatHistory();
  inputElement.value = ""; // Clear input field
  adjustTextareaHeight(inputElement); // Reset textarea height
  showLoadingIndicator();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: CURRENT_MODEL,
        messages: [
          ...chatHistory.slice(-10).map(msg => ({ // Send last 10 messages for context
            role: msg.role,
            // Ensure content is an array for multimodal support in backend
            content: typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : msg.content
          })),
          { role: "user", content: messageContent }
        ]
      })
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMessage = data.error || "Unknown error.";
      throw new Error(errorMessage);
    }

    const aiResponse = data.response || "No response from backend.";
    chatHistory.push({ role: "assistant", content: aiResponse });
    updateChatHistory();

  } catch (err) {
    console.error("Error:", err);
    chatHistory.push({ role: "assistant", content: `Error: ${err.message}` });
    updateChatHistory();
  } finally {
    hideLoadingIndicator();
  }
}

// Function to update chat history in UI
function updateChatHistory() {
  const chatBox = document.getElementById("chatBox");
  chatBox.innerHTML = ""; // Clear existing content
  chatHistory.forEach((message) => {
    const messageDiv = document.createElement("div");
    messageDiv.className = message.role === "user" ? "user-message" : "ai-message";

    const avatarDiv = document.createElement("div");
    avatarDiv.className = "message-avatar";
    avatarDiv.textContent = message.role === "user" ? "You" : "AI"; // Simple avatar text

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    // Handle HTML content (like generated images) vs plain text
    if (typeof message.content === 'string' && message.content.includes('<img src=')) { // Simple check for image HTML
        contentDiv.innerHTML = message.content;
    } else if (Array.isArray(message.content)) {
      // For multi-part messages, display text or a generic message
      const textPart = message.content.find(part => part.type === 'text');
      contentDiv.innerHTML = marked.parse(textPart ? textPart.text : "User sent an image/file."); // Use Marked for Markdown
    } else {
      contentDiv.innerHTML = marked.parse(message.content); // Use Marked for Markdown
    }
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    chatBox.appendChild(messageDiv);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Textarea auto-resize
function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto'; // Reset height
    textarea.style.height = textarea.scrollHeight + 'px'; // Set to scroll height
}

// Loading indicator functions
function showLoadingIndicator() {
  hideLoadingIndicator();
  const chatBox = document.getElementById("chatBox");
  const loadingDiv = document.createElement("div");
  loadingDiv.id = "loadingIndicator";
  loadingDiv.className = "ai-message";
  loadingDiv.innerHTML = `<div class="message-avatar">AI</div><div class="message-content"><div class="loading-spinner"></div> Processing...</div>`;
  chatBox.appendChild(loadingDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function hideLoadingIndicator() {
  const loadingDiv = document.getElementById("loadingIndicator");
  if (loadingDiv) loadingDiv.remove();
}

// File upload handling and preview
function uploadFile() {
  const fileInput = document.getElementById("fileUpload");
  const file = fileInput.files[0];
  if (!file) return;

  const chatBox = document.getElementById("chatBox");
  const previewDiv = document.createElement("div");
  previewDiv.className = "file-preview ai-message"; // Style like an AI message for consistency
  chatBox.appendChild(previewDiv); // Add to chatBox for visual feedback

  const avatarDiv = document.createElement("div");
  avatarDiv.className = "message-avatar";
  avatarDiv.textContent = "AI"; // AI's response to file upload

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  previewDiv.appendChild(avatarDiv);
  previewDiv.appendChild(contentDiv);

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement("img");
      img.src = event.target.result;
      img.alt = "Uploaded image preview";
      contentDiv.innerHTML = `<p>Image ready: ${file.name}</p>`;
      contentDiv.appendChild(img);
      document.getElementById("userInput").value = `Image selected: ${file.name}. Please enter your question or instruction regarding the image.`;
    };
    reader.readAsDataURL(file);
  } else if (file.type === 'application/pdf') {
    contentDiv.innerHTML = `<p>PDF selected: ${file.name} <div data-lucide="file-text" style="display:inline-block; vertical-align:middle; width:20px; height:20px; stroke:#fff;"></div></p>`;
    document.getElementById("userInput").value = `PDF selected: ${file.name}. Please ask questions about its content.`;
    lucide.createIcons();
  } else if (file.type.startsWith('text/')) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      contentDiv.innerHTML = `<p>Text file selected: ${file.name}</p><textarea readonly>${content.substring(0, 300)}...</textarea>`;
      document.getElementById("userInput").value = `Text file selected: ${file.name}. Content snippet ready. Ask your question.`;
    };
    reader.readAsText(file);
  } else if (file.type.startsWith('video/')) {
    contentDiv.innerHTML = `<p>Video selected: ${file.name} <div data-lucide="video" style="display:inline-block; vertical-align:middle; width:20px; height:20px; stroke:#fff;"></div></p>`;
    document.getElementById("userInput").value = `Video selected: ${file.name}. What do you want to know about it?`;
    lucide.createIcons();
  }
  else {
    contentDiv.innerHTML = `<p>Unsupported file type: ${file.name}. Please choose an image, text, PDF, or video file.</p>`;
    document.getElementById("userInput").value = `Unsupported file type: ${file.name}.`;
  }
  chatBox.scrollTop = chatBox.scrollHeight;
  fileInput.value = ''; // Clear the file input after selection
}

// Voice recognition
function startVoiceRecognition() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    chatHistory.push({ role: "assistant", content: "Voice input not supported in your browser. Please ensure you are using HTTPS." });
    updateChatHistory();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = "auto"; // Auto-detect language
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    chatHistory.push({ role: "assistant", content: "Listening..." });
    updateChatHistory();
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById("userInput").value = transcript;
    chatHistory.pop(); // Remove "Listening..."
    updateChatHistory();
    search(); // Automatically send the recognized text
  };

  recognition.onerror = (event) => {
    chatHistory.pop(); // Remove "Listening..."
    const errorMsg = {
      'no-speech': "No speech detected. Please try again.",
      'not-allowed': "Microphone permission denied. Please allow microphone access in your browser settings.",
      'service-not-allowed': "Microphone blocked by system/browser. Check your system's privacy settings.",
      'network': "Network error during voice recognition. Check your internet connection."
    }[event.error] || `Voice input error: ${event.error}`;
    chatHistory.push({ role: "assistant", content: errorMsg });
    updateChatHistory();
  };

  recognition.onend = () => {
    if (chatHistory[chatHistory.length - 1]?.content === "Listening...") {
      chatHistory.pop();
      updateChatHistory();
    }
  };

  try {
    recognition.start();
  } catch (error) {
    chatHistory.push({ role: "assistant", content: "Could not start voice input: " + error.message });
    updateChatHistory();
  }
}

// Canvas feature placeholder
function launchCanvas() {
    // This will open a new window/tab with your canvas application
    // You need to create canvas.html and canvas.js files separately
    window.open('canvas.html', '_blank', 'width=800,height=600,resizable=yes,scrollbars=yes');
    alert("Canvas feature is launched in a new window/tab! (Requires canvas.html and canvas.js)");
}

// Placeholder for other sidebar functions
function openSettings() {
    alert("Settings will be implemented here!");
}
function logout() {
    alert("Logout functionality will be implemented here!");
}
function loadChatHistory(chatId) {
    // This would load a specific chat from storage/backend
    alert(`Loading chat history for ID: ${chatId}`);
    // Example: chatHistory = savedChats[chatId]; updateChatHistory();
}

// Initialize buttons and input handlers
window.onload = () => {
  lucide.createIcons(); // Initializes icons
  document.getElementById('modelSelector').textContent = AVAILABLE_MODELS[currentModelIndex].shortName; // Show short name
  document.getElementById('modelSelector').addEventListener('click', switchModel);

  const userInput = document.getElementById("userInput");
  userInput.addEventListener("input", () => adjustTextareaHeight(userInput)); // Auto-resize textarea
  userInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      search();
    }
  });

  // Event listeners for buttons
  document.getElementById("sendButton").addEventListener("click", search);
  document.getElementById("fileUpload").addEventListener("change", uploadFile);
  document.getElementById("voiceIcon").addEventListener("click", startVoiceRecognition);
  // Sidebar buttons already have onclick in HTML

  console.log("App initialized. Current model:", CURRENT_MODEL_NAME);
};

// Add marked.js for Markdown rendering (include it from CDN in index.html head)
// <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
// Make sure to add this script tag in your index.html
