// ========================
// HEALIX AI - MEDICAL ASSISTANT
// ========================

// DOM elements
const messagesContainer = document.getElementById("messagesContainer");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const typingIndicator = document.getElementById("typingIndicator");
const messagesWrapper = document.getElementById("messagesWrapper");

// Helper: scroll to bottom
function scrollToBottom() {
    if (messagesWrapper) {
        messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
    }
}

// Helper: Add message to UI (type: 'user' or 'bot')
function addMessage(text, sender) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender === "user" ? "user-message" : "bot-message"}`;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (sender === "user") {
        messageDiv.innerHTML = `
            <div class="avatar user-avatar"><i class="fas fa-user-md"></i></div>
            <div class="bubble user-bubble">
                <span class="message-text">${escapeHtml(text)}</span>
                <span class="timestamp">${timeString}</span>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="avatar bot-avatar"><i class="fas fa-robot"></i></div>
            <div class="bubble bot-bubble">
                <span class="message-text">${escapeHtml(text)}</span>
                <span class="timestamp">${timeString}</span>
            </div>
        `;
    }
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// Simple XSS protection
function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
        return c;
    });
}

// Show/Hide typing animation
function showTyping(show) {
    if (show) {
        typingIndicator.classList.add("active");
        scrollToBottom();
    } else {
        typingIndicator.classList.remove("active");
    }
}

// Core API call to Vercel Backend
async function fetchMedicalReply(userMessage) {
    try {
        // تم تحديث الرابط ليشير إلى خادم Vercel بدلاً من localhost
        const response = await fetch("https://healix-ai-phi.vercel.app/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: userMessage })
        });
        
        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        } else {
            return "I'm sorry, I couldn't process that request. Please try again.";
        }
    } catch (error) {
        console.error("Frontend Error:", error);
        return "⚠️ Connection error. Please check your internet and try again.";
    }
}

// Send message handler
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    
    // disable input while processing (UX)
    userInput.disabled = true;
    sendBtn.disabled = true;
    micBtn.disabled = true;
    
    // add user message to chat
    addMessage(text, "user");
    userInput.value = "";
    
    // show typing indicator
    showTyping(true);
    
    // get AI response
    const botReply = await fetchMedicalReply(text);
    
    // hide typing indicator
    showTyping(false);
    
    // add bot response
    addMessage(botReply, "bot");
    
    // re-enable inputs
    userInput.disabled = false;
    sendBtn.disabled = false;
    micBtn.disabled = false;
    userInput.focus();
}

// Voice input (with webkit speech recognition)
function initVoiceInput() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        micBtn.style.opacity = "0.5";
        micBtn.title = "Voice not supported in this browser";
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    let listening = false;
    
    micBtn.addEventListener("click", () => {
        if (listening || userInput.disabled) return;
        try {
            recognition.start();
            listening = true;
            micBtn.style.background = "#E0F2EF";
            micBtn.style.color = "#008B74";
            micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        } catch(e) { console.warn(e); }
    });
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        micBtn.style.background = "";
        micBtn.style.color = "";
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        listening = false;
        // auto-send after voice
        setTimeout(() => sendMessage(), 100);
    };
    
    recognition.onerror = () => {
        micBtn.style.background = "";
        micBtn.style.color = "";
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        listening = false;
    };
    
    recognition.onend = () => {
        micBtn.style.background = "";
        micBtn.style.color = "";
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        listening = false;
    };
}

// Event listeners
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !userInput.disabled) {
        e.preventDefault();
        sendMessage();
    }
});

// initial focus
window.addEventListener("load", () => {
    userInput.focus();
    initVoiceInput();
    scrollToBottom();
});

// Add emergency disclaimer after load
function appendEmergencyDisclaimer() {
    const disclaimerDiv = document.createElement("div");
    disclaimerDiv.className = "message bot-message";
    disclaimerDiv.style.marginTop = "8px";
    disclaimerDiv.innerHTML = `
        <div class="avatar bot-avatar"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="bubble bot-bubble" style="background: #FFF8E7; border-left: 4px solid #FFB347;">
            <span class="message-text">⚠️ <strong>Medical Disclaimer:</strong> Healix is an AI assistant, not a doctor. In case of emergency, please contact your local medical services immediately. Always consult a healthcare professional for medical advice.</span>
        </div>
    `;
    messagesContainer.appendChild(disclaimerDiv);
    scrollToBottom();
}

setTimeout(() => {
    appendEmergencyDisclaimer();
}, 500);
