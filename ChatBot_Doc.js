// ===================================================
// HEALIX AI - MEDICAL ASSISTANT
// Enhanced JavaScript v3.0 (Dark Elegant)
// ===================================================

'use strict';

// ===================================================
// 1) CONFIGURATION
// ===================================================
const CONFIG = {
    API_URL: "https://healix-ai-phi.vercel.app/api/chat",
    API_TIMEOUT_MS: 30000,
    MAX_MESSAGE_LENGTH: 2000,
    STORAGE_KEY: "healix_chat_history"
};

// ===================================================
// 2) DOM ELEMENTS
// ===================================================
const DOM = {
    messagesContainer: document.getElementById("messagesContainer"),
    messagesWrapper:   document.getElementById("messagesWrapper"),
    userInput:         document.getElementById("userInput"),
    sendBtn:           document.getElementById("sendBtn"),
    typingIndicator:   document.getElementById("typingIndicator"),
    chatForm:          document.getElementById("chatForm"),
    clearBtn:          document.getElementById("clearBtn"),
    clearModal:        document.getElementById("clearModal"),
    cancelClear:       document.getElementById("cancelClear"),
    confirmClear:      document.getElementById("confirmClear")
};

// ===================================================
// 3) STATE
// ===================================================
const STATE = {
    isSending: false,
    abortController: null
};

// ===================================================
// 4) UTILITIES
// ===================================================

/**
 * حماية من XSS
 */
function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * الوقت الحالي
 */
function getTimeString() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ===================================================
// 5) UI HELPERS
// ===================================================

function scrollToBottom(smooth = true) {
    if (!DOM.messagesWrapper) return;
    requestAnimationFrame(() => {
        DOM.messagesWrapper.scrollTo({
            top: DOM.messagesWrapper.scrollHeight,
            behavior: smooth ? "smooth" : "auto"
        });
    });
}

/**
 * إضافة رسالة للواجهة
 */
function addMessage(text, sender, options = {}) {
    if (!DOM.messagesContainer) return;

    const { isDisclaimer = false } = options;
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender === "user" ? "user-message" : "bot-message"}`;

    const timeString = getTimeString();
    const safeText = escapeHtml(text);
    const formattedText = safeText.replace(/\n/g, "<br>");

    if (sender === "user") {
        messageDiv.innerHTML = `
            <div class="avatar user-avatar"><i class="fas fa-user" aria-hidden="true"></i></div>
            <div class="bubble user-bubble">
                <span class="message-text">${formattedText}</span>
                <span class="timestamp">${timeString}</span>
            </div>
        `;
    } else {
        const bubbleStyle = isDisclaimer
            ? 'style="background:rgba(245,158,11,0.08);border-color:rgba(245,158,11,0.3);border-left:3px solid #f59e0b;"'
            : "";
        const avatarIcon = isDisclaimer ? "fa-exclamation-triangle" : "fa-robot";
        
        messageDiv.innerHTML = `
            <div class="avatar bot-avatar"><i class="fas ${avatarIcon}" aria-hidden="true"></i></div>
            <div class="bubble bot-bubble" ${bubbleStyle}>
                <span class="message-text">${formattedText}</span>
                <span class="timestamp">${timeString}</span>
            </div>
        `;
    }

    DOM.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function showTyping(show) {
    if (!DOM.typingIndicator) return;
    DOM.typingIndicator.classList.toggle("active", show);
    DOM.typingIndicator.setAttribute("aria-hidden", show ? "false" : "true");
    if (show) scrollToBottom();
}

function setInputsEnabled(enabled) {
    if (DOM.userInput) DOM.userInput.disabled = !enabled;
    if (DOM.sendBtn)   DOM.sendBtn.disabled = !enabled;
}

function focusInput() {
    if (DOM.userInput && !DOM.userInput.disabled) {
        DOM.userInput.focus({ preventScroll: true });
    }
}

// ===================================================
// 6) API COMMUNICATION
// ===================================================
async function fetchMedicalReply(userMessage) {
    if (STATE.abortController) {
        STATE.abortController.abort();
    }
    STATE.abortController = new AbortController();

    const timeoutId = setTimeout(() => {
        STATE.abortController.abort();
    }, CONFIG.API_TIMEOUT_MS);

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMessage }),
            signal: STATE.abortController.signal
        });

        clearTimeout(timeoutId);

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error("Invalid JSON:", parseError);
            return { error: true, text: "⚠️ The server returned an invalid response. Please try again." };
        }

        if (!response.ok) {
            console.error("API Error:", response.status, data);
            const msg = data?.error?.message
                || data?.message
                || `Server error (${response.status}). Please try again later.`;
            return { error: true, text: `⚠️ ${msg}` };
        }

        if (data.error) {
            console.error("Backend Error:", data.error);
            return {
                error: true,
                text: `⚠️ ${data.error.message || "An unexpected error occurred."}`
            };
        }

        if (data.choices?.[0]?.message?.content) {
            return { error: false, text: data.choices[0].message.content.trim() };
        }

        console.error("Unexpected response:", data);
        return { error: true, text: "⚠️ Unexpected response from server. Please try again." };

    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === "AbortError") {
            return { error: true, text: "⚠️ Request timed out. The server took too long to respond." };
        }

        console.error("Fetch Error:", error);
        return { error: true, text: "⚠️ Connection error. Please check your internet and try again." };
    } finally {
        STATE.abortController = null;
    }
}

// ===================================================
// 7) SEND MESSAGE
// ===================================================
async function sendMessage() {
    if (STATE.isSending) return;

    const text = DOM.userInput?.value.trim();
    if (!text) return;

    if (text.length > CONFIG.MAX_MESSAGE_LENGTH) {
        addMessage(`Message is too long. Max ${CONFIG.MAX_MESSAGE_LENGTH} characters.`, "bot");
        return;
    }

    STATE.isSending = true;
    setInputsEnabled(false);

    addMessage(text, "user");
    if (DOM.userInput) DOM.userInput.value = "";

    showTyping(true);

    const result = await fetchMedicalReply(text);

    showTyping(false);
    addMessage(result.text, "bot");

    STATE.isSending = false;
    setInputsEnabled(true);
    focusInput();
}

// ===================================================
// 8) CLEAR CONVERSATION
// ===================================================
function openClearModal() {
    if (!DOM.clearModal) return;
    DOM.clearModal.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeClearModal() {
    if (!DOM.clearModal) return;
    DOM.clearModal.classList.remove("active");
    document.body.style.overflow = "";
}

function clearConversation() {
    if (!DOM.messagesContainer) return;

    // إلغاء أي طلب جاري
    if (STATE.abortController) {
        STATE.abortController.abort();
        STATE.abortController = null;
    }

    // مسح الرسائل
    DOM.messagesContainer.innerHTML = "";

    // إضافة رسالة ترحيب جديدة
    const welcomeDiv = document.createElement("div");
    welcomeDiv.className = "message bot-message";
    welcomeDiv.innerHTML = `
        <div class="avatar bot-avatar" aria-hidden="true">
            <i class="fas fa-robot"></i>
        </div>
        <div class="bubble bot-bubble">
            <span class="message-text">👋 Conversation cleared. How can I help you today?</span>
            <span class="timestamp">${getTimeString()}</span>
        </div>
    `;
    DOM.messagesContainer.appendChild(welcomeDiv);

    // إعادة تعيين حالة الإرسال
    STATE.isSending = false;
    setInputsEnabled(true);
    showTyping(false);

    // مسح من localStorage
    try {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
    } catch (e) { /* ignore */ }

    closeClearModal();
    focusInput();
    scrollToBottom(false);
}

// ===================================================
// 9) EMERGENCY DISCLAIMER
// ===================================================
function appendEmergencyDisclaimer() {
    if (!DOM.messagesContainer) return;

    const disclaimerDiv = document.createElement("div");
    disclaimerDiv.className = "message bot-message";
    disclaimerDiv.style.marginTop = "8px";
    disclaimerDiv.innerHTML = `
        <div class="avatar bot-avatar" style="background:rgba(245,158,11,0.1);color:#f59e0b;border-color:rgba(245,158,11,0.3);">
            <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        </div>
        <div class="bubble bot-bubble" style="background:rgba(245,158,11,0.06);border-color:rgba(245,158,11,0.25);">
            <span class="message-text">⚠️ <strong>Medical Disclaimer:</strong> Healix is an AI assistant, not a doctor. In case of emergency, please contact your local medical services immediately. Always consult a healthcare professional for medical advice.</span>
        </div>
    `;
    DOM.messagesContainer.appendChild(disclaimerDiv);
    scrollToBottom();
}

// ===================================================
// 10) EVENT LISTENERS
// ===================================================
function attachEventListeners() {
    if (DOM.sendBtn) {
        DOM.sendBtn.addEventListener("click", sendMessage);
    }

    if (DOM.chatForm) {
        DOM.chatForm.addEventListener("submit", (e) => {
            e.preventDefault();
            sendMessage();
        });
    }

    if (DOM.userInput) {
        DOM.userInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!STATE.isSending) sendMessage();
            }
        });

        DOM.userInput.addEventListener("input", () => {
            const length = DOM.userInput.value.length;
            if (length > CONFIG.MAX_MESSAGE_LENGTH) {
                DOM.userInput.value = DOM.userInput.value.slice(0, CONFIG.MAX_MESSAGE_LENGTH);
            }
        });
    }

    // Clear conversation
    if (DOM.clearBtn) {
        DOM.clearBtn.addEventListener("click", openClearModal);
    }
    if (DOM.cancelClear) {
        DOM.cancelClear.addEventListener("click", closeClearModal);
    }
    if (DOM.confirmClear) {
        DOM.confirmClear.addEventListener("click", clearConversation);
    }
    if (DOM.clearModal) {
        // إغلاق عند الضغط على الخلفية
        DOM.clearModal.addEventListener("click", (e) => {
            if (e.target === DOM.clearModal) closeClearModal();
        });
    }

    // اختصارات لوحة المفاتيح
    document.addEventListener("keydown", (e) => {
        // Ctrl/Cmd + K = تركيز على الإدخال
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
            e.preventDefault();
            focusInput();
        }
        // Esc = إغلاق الـ modal أو إلغاء الطلب
        if (e.key === "Escape") {
            if (DOM.clearModal?.classList.contains("active")) {
                closeClearModal();
            } else if (STATE.isSending && STATE.abortController) {
                STATE.abortController.abort();
            }
        }
    });

    // إلغاء الطلب عند إغلاق الصفحة
    window.addEventListener("beforeunload", () => {
        if (STATE.abortController) {
            STATE.abortController.abort();
        }
    });

    // إعادة التركيز لما المستخدم يرجع للتاب
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) focusInput();
    });
}

// ===================================================
// 11) INITIALIZATION
// ===================================================
function init() {
    if (!DOM.messagesContainer || !DOM.userInput || !DOM.sendBtn) {
        console.error("Healix AI: Required DOM elements not found.");
        return;
    }

    attachEventListeners();
    focusInput();
    scrollToBottom(false);

    setTimeout(appendEmergencyDisclaimer, 400);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
