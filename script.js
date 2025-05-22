// --- START: Removed hardcoded sensitive information ---
// const OPENROUTER_API_KEY = "...";
// const HTTP_REFERER = "...";
// const SITE_NAME = "...";
// These are now securely handled in backend via Vercel Environment Variables
// --- END ---

// Ensure pdfjsLib is available globally (from CDN in index.html)
if (typeof pdfjsLib === 'undefined') {
  console.error("pdf.js library not loaded. PDF parsing will not work.");
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

const AVAILABLE_MODELS = [
  { id: "google/gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash", shortName: "GF" },
  { id: "deepseek/deepseek-chat:free", name: "DeepSeek Chat Free", shortName: "DS" },
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

  let messageContent = []; // This will be the actual content sent to the backend
  let displayInput = input; // This is what is displayed in the chat history for the user

  // Handle file data if present from uploadFile function
  const fileData = inputElement.dataset.fileData; // Custom attribute to store file data
  const fileType = inputElement.dataset.fileType;
  const fileName = inputElement.dataset.fileName;

  if (fileData && fileType) {
    if (fileType.startsWith('image/')) {
        messageContent.push({
            "type": "image_url",
            "image_url": { "url": fileData } // Base64 image data
        });
        displayInput = `Image (${fileName}) selected: ${input}`; // Display original user input with file info
    } else if (fileType === 'application/pdf' || fileType.startsWith('text/')) {
        // For PDF/Text, fileData contains extracted text
        messageContent.push({ "type": "text", "text": `Content from ${fileName}: ${fileData}\n\nUser's question: ${input}` });
        displayInput = `File (${fileName}) content processed. Question: ${input}`;
    } else if (fileType.startsWith('video/')) {
        // For video, we can only send the filename and user's instruction
        messageContent.push({ "type": "text", "text": `User uploaded a video named '${fileName}'. Their question is: ${input}` });
        displayInput = `Video (${fileName}) uploaded. Question: ${input}`;
    }
    // Clear dataset attributes after use
    delete inputElement.dataset.fileData;
    delete inputElement.dataset.fileType;
    delete inputElement.dataset.fileName;
  } else {
    // For regular text input or image URLs pasted directly in input
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
        displayInput = textPart + " (Image URL attached)";
      } else {
        const defaultText = "Analyze this image.";
        messageContent.push({ "type": "text", "text": defaultText });
        displayInput = `Image URL: ${imageMatch[0]} (Instruction: ${defaultText})`;
      }
    } else {
      // Regular text input
      messageContent.push({ "type": "text", "text": input });
      displayInput = input;
    }
  }

  chatHistory.push({ role: "user", content: displayInput });
  updateChatHistory();
  inputElement.value = ""; // Clear input field
  adjustTextareaHeight(inputElement); // Reset textarea height
  showLoadingIndicator();

  try {
    const messagesToSend = chatHistory.slice(-10).map(msg => ({ // Send last 10 messages for context
        role: msg.role,
        content: typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : msg.content
    }));
    messagesToSend.push({ role: "user", content: messageContent }); // Add the current user message

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: CURRENT_MODEL,
        messages: messagesToSend
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

    let renderedContent = '';
    if (typeof message.content === 'string') {
        // Handle HTML content like generated images (simple check)
        if (message.content.includes('<img src=')) {
            renderedContent = message.content;
        } else {
            renderedContent = marked.parse(message.content);
        }
    } else if (Array.isArray(message.content)) {
        // Handle multimodal content for display
        message.content.forEach(part => {
            if (part.type === 'text') {
                renderedContent += marked.parse(part.text);
            } else if (part.type === 'image_url') {
                renderedContent += `<img src="${part.image_url.url}" style="max-width:100%; border-radius:8px; margin-top:10px;" alt="Attached Image">`;
            }
            // Add more types as needed for display
        });
    }

    contentDiv.innerHTML = renderedContent;
    
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
async function uploadFile() {
  const fileInput = document.getElementById("fileUpload");
  const file = fileInput.files[0];
  if (!file) return;

  const inputElement = document.getElementById("userInput");
  const chatBox = document.getElementById("chatBox");
  const previewDiv = document.createElement("div");
  previewDiv.className = "file-preview ai-message"; // Style like an AI message for consistency
  chatBox.appendChild(previewDiv);

  const avatarDiv = document.createElement("div");
  avatarDiv.className = "message-avatar";
  avatarDiv.textContent = "AI";

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  previewDiv.appendChild(avatarDiv);
  previewDiv.appendChild(contentDiv);

  // Store file data in a dataset attribute of the input element for search() to pick up
  inputElement.dataset.fileType = file.type;
  inputElement.dataset.fileName = file.name;


  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement("img");
      img.src = event.target.result;
      img.alt = "Uploaded image preview";
      contentDiv.innerHTML = `<p>Image ready: <strong>${file.name}</strong></p>`;
      contentDiv.appendChild(img);
      inputElement.value = `Describe or ask a question about this image.`;
      inputElement.dataset.fileData = event.target.result; // Base64 data for image
      adjustTextareaHeight(inputElement);
    };
    reader.readAsDataURL(file);
  } else if (file.type === 'application/pdf') {
    contentDiv.innerHTML = `<p>Processing PDF: <strong>${file.name}</strong> <div data-lucide="file-text" style="display:inline-block; vertical-align:middle; width:20px; height:20px; stroke:#fff;"></div></p>`;
    lucide.createIcons(); // Re-render lucide icons

    try {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const typedarray = new Uint8Array(event.target.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(' ') + '\n';
            }
            contentDiv.innerHTML = `<p>PDF content extracted from: <strong>${file.name}</strong></p><textarea readonly>${fullText.substring(0, 500)}...</textarea><p>Enter your question about the PDF content below.</p>`;
            inputElement.value = `Ask your question about the content of "${file.name}".`;
            inputElement.dataset.fileData = fullText; // Store extracted text
            adjustTextareaHeight(inputElement);
        };
        reader.readAsArrayBuffer(file);
    } catch (error) {
        console.error("Error parsing PDF:", error);
        contentDiv.innerHTML = `<p>Failed to read PDF: <strong>${file.name}</strong>. Error: ${error.message}</p>`;
        inputElement.value = `Error reading PDF: ${file.name}. Please try again.`;
        delete inputElement.dataset.fileData; // Clear data if error
    }
  } else if (file.type.startsWith('text/')) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      contentDiv.innerHTML = `<p>Text file loaded: <strong>${file.name}</strong></p><textarea readonly>${content.substring(0, 500)}...</textarea><p>Enter your question about this text.</p>`;
      inputElement.value = `Ask your question about the content of "${file.name}".`;
      inputElement.dataset.fileData = content; // Store full text
      adjustTextareaHeight(inputElement);
    };
    reader.readAsText(file);
  } else if (file.type.startsWith('video/')) {
    contentDiv.innerHTML = `<p>Video selected: <strong>${file.name}</strong> <div data-lucide="video" style="display:inline-block; vertical-align:middle; width:20px; height:20px; stroke:#fff;"></div></p><p>Video analysis is not fully supported yet. Please ask a general question about the video.</p>`;
    lucide.createIcons();
    inputElement.value = `Video "${file.name}" uploaded. What do you want to know about it?`;
    // For video, we just store a placeholder and rely on user's prompt
    inputElement.dataset.fileData = `User uploaded a video: ${file.name}`;
    adjustTextareaHeight(inputElement);
  } else {
    contentDiv.innerHTML = `<p>Unsupported file type: <strong>${file.name}</strong>. Please choose an image, text, PDF, or video file.</p>`;
    inputElement.value = `Unsupported file type: ${file.name}.`;
    delete inputElement.dataset.fileData;
    delete inputElement.dataset.fileType;
    delete inputElement.dataset.fileName;
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

// Canvas feature
function launchCanvas() {
    // This will open a new window/tab with your canvas application
    // You need to create canvas.html and canvas.js files separately in the public directory
    window.open('/canvas.html', '_blank', 'width=800,height=600,resizable=yes,scrollbars=yes');
}

// Placeholder for other sidebar functions
function openSettings() {
    alert("Settings functionality will be implemented here!");
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
    if (event.key === "Enter" && !event.shiftKey) { // Check for Enter key without Shift
      event.preventDefault(); // Prevent new line in textarea
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
