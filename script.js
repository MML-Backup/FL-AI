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

const chatHistory = [];

function switchModel() {
  currentModelIndex = (currentModelIndex + 1) % AVAILABLE_MODELS.length;
  CURRENT_MODEL = AVAILABLE_MODELS[currentModelIndex].id;
  CURRENT_MODEL_NAME = AVAILABLE_MODELS[currentModelIndex].name;
  document.getElementById('modelSelector').textContent = CURRENT_MODEL_NAME;
  console.log("Switched model to:", CURRENT_MODEL_NAME);
}

async function search() {
  const inputElement = document.getElementById("userInput");
  const input = inputElement.value.trim();
  if (!input) return;

  let messageContent = [];
  let displayInput = input;
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

  chatHistory.push({ role: "user", content: displayInput });
  updateChatHistory();
  inputElement.value = ""; // Clear input field
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
          ...chatHistory.slice(-10).map(msg => ({
            role: msg.role,
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

function updateChatHistory() {
  const chatBox = document.getElementById("chatBox");
  chatBox.innerHTML = "";
  chatHistory.forEach((message) => {
    const messageDiv = document.createElement("div");
    messageDiv.className = message.role === "user" ? "user-message" : "ai-message";
    messageDiv.innerHTML = message.content;
    chatBox.appendChild(messageDiv);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showLoadingIndicator() {
  hideLoadingIndicator();
  const chatBox = document.getElementById("chatBox");
  const loadingDiv = document.createElement("div");
  loadingDiv.id = "loadingIndicator";
  loadingDiv.className = "ai-message";
  loadingDiv.innerHTML = `<div class="loading-spinner"></div> Processing...`;
  chatBox.appendChild(loadingDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function hideLoadingIndicator() {
  const loadingDiv = document.getElementById("loadingIndicator");
  if (loadingDiv) loadingDiv.remove();
}

function uploadFile() {
  const fileInput = document.getElementById("fileUpload");
  const file = fileInput.files[0];
  if (!file) return;

  if (file.type.startsWith('image/')) {
    document.getElementById("userInput").value = `Image file selected: ${file.name}. Please enter instruction or paste image URL if needed.`;
  } else if (file.type.startsWith('text/')) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      document.getElementById("userInput").value = `Text file selected: ${file.name}. Content snippet:\n\n${content.substring(0, 200)}...`;
    };
    reader.readAsText(file);
  } else {
    document.getElementById("userInput").value = `Unsupported file type selected: ${file.name}.`;
  }
  fileInput.value = '';
}

function startVoiceRecognition() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    chatHistory.push({ role: "assistant", content: "Voice input not supported in your browser." });
    updateChatHistory();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = "auto";
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
    search();
  };

  recognition.onerror = (event) => {
    chatHistory.pop(); // Remove "Listening..."
    const errorMsg = {
      'no-speech': "No speech detected.",
      'not-allowed': "Microphone permission denied.",
      'service-not-allowed': "Microphone blocked by system/browser."
    }[event.error] || "Voice input error.";
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

// Initialize buttons and input handlers
window.onload = () => {
  lucide.createIcons();
  document.getElementById('modelSelector').textContent = CURRENT_MODEL_NAME;
  document.getElementById('modelSelector').addEventListener('click', switchModel);

  // ✅ ENTER key to trigger search
  document.getElementById("userInput").addEventListener("keypress", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      search();
    }
  });

  // ✅ Dynamic buttons
  document.getElementById("sendButton").addEventListener("click", search);
  document.getElementById("fileUpload").addEventListener("change", uploadFile);
  document.getElementById("voiceIcon").addEventListener("click", startVoiceRecognition);

  console.log("App initialized. Current model:", CURRENT_MODEL_NAME);
};
