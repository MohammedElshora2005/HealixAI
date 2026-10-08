// ===================================================
// HEALIX AI - MEDICAL ASSISTANT
// Enhanced JavaScript v2.0
// ===================================================

'use strict';

// ===================================================
// 1) CONFIGURATION
// ===================================================
const CONFIG = {
    API_URL: "https://healix-ai-phi.vercel.app/api/chat",
    API_TIMEOUT_MS: 30000,
    MAX_MESSAGE_LENGTH: 2000,
    VOICE_LANG: "en-US",
    STORAGE_KEY: "healix_chat_history",
    MAX_HISTORY_ITEMS: 50
};

// ===================================================
// 2) DOM ELEMENTS
// ===================================================
const DOM = {
    messagesContainer: document.getElementById("messagesContainer"),
    messagesWrapper:   document.getElementById("messagesWrapper"),
    userInput:         document.getElementById("userInput"),
    sendBtn:           document.getElementById("sendBtn"),
    micBtn:            document.getElementById("micBtn"),
    typingIndicator:   document.getElementById("typingIndicator"),
    chatForm:          document.getElementById("chatForm")
};

// ===================================================
// 3) STATE
// ===================================================
const STATE = {
    isSending: false,
    isListening: false,
    recognition: null,
    abortController: null
};

// ===================================================
// 4) UTILITY FUNCTIONS
// ===================================================

/**
 * حماية من XSS — يهرب كل الرموز الخطيرة
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
 * تنسيق الوقت الحالي
 */
function getTimeString() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Debounce — يمنع تنفيذ الدالة أكثر من مرة بسرعة
 */
function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Throttle — يحد من تكرار التنفيذ
 */
function throttle(fn, limit) {
    let inThrottle = false;
    return function (...args) {
        if (inThrottle) return;
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
    };
}

// ===================================================
// 5) UI HELPERS
// ===================================================

/**
 * التمرير لأسفل الشات
 */
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

    const { isError = false, isDisclaimer = false } = options;
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender === "user" ? "user-message" : "bot-message"}`;

    const timeString = getTimeString();
    const safeText = escapeHtml(text);
    const formattedText = safeText.replace(/\n/g, "<br>");

    if (sender === "user") {
        messageDiv.innerHTML = `
            <div class="avatar user-avatar"><i class="fas fa-user-md" aria-hidden="true"></i></div>
            <div class="bubble user-bubble">
                <span class="message-text">${formattedText}</span>
                <span class="timestamp">${timeString}</span>
            </div>
        `;
    } else {
        const bubbleStyle = isDisclaimer
            ? 'style="background:#FFF8E7;border-left:4px solid #FFB347;"'
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

    // حفظ في localStorage
    saveMessageToHistory({ text, sender, time: timeString });
}

/**
 * إظهار/إخفاء مؤشر الكتابة
 */
function showTyping(show) {
    if (!DOM.typingIndicator) return;
    DOM.typingIndicator.classList.toggle("active", show);
    DOM.typingIndicator.setAttribute("aria-hidden", show ? "false" : "true");
    if (show) scrollToBottom();
}

/**
 * تعطيل/تفعيل عناصر الإدخال
 */
function setInputsEnabled(enabled) {
    if (DOM.userInput) DOM.userInput.disabled = !enabled;
    if (DOM.sendBtn)   DOM.sendBtn.disabled = !enabled;
    if (DOM.micBtn)    DOM.micBtn.disabled = !enabled;
}

/**
 * تركيز على الإدخال
 */
function focusInput() {
    if (DOM.userInput && !DOM.userInput.disabled) {
        DOM.userInput.focus({ preventScroll: true });
    }
}

// ===================================================
// 6) LOCAL STORAGE (اختياري — لحفظ المحادثة)
// ===================================================
function saveMessageToHistory(message) {
    try {
        const history = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || "[]");
        history.push(message);
        // نحتفظ بآخر N رسالة فقط
        if (history.length > CONFIG.MAX_HISTORY_ITEMS) {
            history.splice(0, history.length - CONFIG.MAX_HISTORY_ITEMS);
        }
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
        // تجاهل الأخطاء (localStorage ممكن يكون معطل)
    }
}

// ===================================================
// 7) API COMMUNICATION
// ===================================================

/**
 * إرسال رسالة للـ API واستقبال الرد
 */
async function fetchMedicalReply(userMessage) {
    // إلغاء أي طلب سابق
    if (STATE.abortController) {
        STATE.abortController.abort();
    }
    STATE.abortController = new AbortController();

    // Timeout
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

        // قراءة الرد (JSON)
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error("Invalid JSON response:", parseError);
            return { error: true, text: "⚠️ The server returned an invalid response. Please try again." };
        }

        // فحص حالة HTTP
        if (!response.ok) {
            console.error("API Error:", response.status, data);
            const msg = data?.error?.message
                || data?.message
                || `Server error (${response.status}). Please try again later.`;
            return { error: true, text: `⚠️ ${msg}` };
        }

        // فحص وجود خطأ في الرد
        if (data.error) {
            console.error("Backend Error:", data.error);
            return {
                error: true,
                text: `⚠️ ${data.error.message || "An unexpected error occurred."}`
            };
        }

        // استخراج الرد
        if (data.choices?.[0]?.message?.content) {
            return { error: false, text: data.choices[0].message.content.trim() };
        }

        console.error("Unexpected response shape:", data);
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
// 8) SEND MESSAGE HANDLER
// ===================================================
async function sendMessage() {
    // منع الإرسال المتكرر
    if (STATE.isSending) return;

    const text = DOM.userInput?.value.trim();
    if (!text) return;

    // فحص الطول
    if (text.length > CONFIG.MAX_MESSAGE_LENGTH) {
        addMessage(`Message is too long. Max ${CONFIG.MAX_MESSAGE_LENGTH} characters.`, "bot", { isError: true });
        return;
    }

    STATE.isSending = true;
    setInputsEnabled(false);

    // إضافة رسالة المستخدم
    addMessage(text, "user");
    if (DOM.userInput) DOM.userInput.value = "";

    // إظهار مؤشر الكتابة
    showTyping(true);

    // جلب الرد
    const result = await fetchMedicalReply(text);

    // إخفاء المؤشر
    showTyping(false);

    // إضافة رد البوت
    addMessage(result.text, "bot", { isError: result.error });

    // إعادة التفعيل
    STATE.isSending = false;
    setInputsEnabled(true);
    focusInput();
}

// ===================================================
// 9) VOICE INPUT
// ===================================================
function initVoiceInput() {
    if (!DOM.micBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // لو المتصفح لا يدعم
    if (!SpeechRecognition) {
        DOM.micBtn.style.opacity = "0.5";
        DOM.micBtn.style.cursor = "not-allowed";
        DOM.micBtn.title = "Voice not supported in this browser";
        DOM.micBtn.setAttribute("aria-disabled", "true");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = CONFIG.VOICE_LANG;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    STATE.recognition = recognition;

    // بدء الاستماع
    DOM.micBtn.addEventListener("click", () => {
        if (STATE.isListening || STATE.isSending || DOM.userInput?.disabled) return;
        try {
            recognition.start();
        } catch (e) {
            console.warn("Failed to start recognition:", e);
        }
    });

    // بدء
    recognition.onstart = () => {
        STATE.isListening = true;
        DOM.micBtn.classList.add("listening");
        DOM.micBtn.style.background = "#E0F2EF";
        DOM.micBtn.style.color = "#008B74";
        DOM.micBtn.innerHTML = '<i class="fas fa-microphone-slash" aria-hidden="true"></i>';
        DOM.micBtn.setAttribute("aria-label", "Stop listening");
    };

    // نتيجة
    recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript && DOM.userInput) {
            DOM.userInput.value = transcript;
            // إرسال تلقائي بعد لحظة
            setTimeout(() => {
                if (!STATE.isSending) sendMessage();
            }, 150);
        }
    };

    // خطأ
    recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
            addMessage("Microphone access denied. Please enable it in your browser settings.", "bot", { isError: true });
        }
    };

    // نهاية (تُنفذ دائماً)
    recognition.onend = () => {
        STATE.isListening = false;
        DOM.micBtn.classList.remove("listening");
        DOM.micBtn.style.background = "";
        DOM.micBtn.style.color = "";
        DOM.micBtn.innerHTML = '<i class="fas fa-microphone" aria-hidden="true"></i>';
        DOM.micBtn.setAttribute("aria-label", "Voice input");
    };
}

// ===================================================
// 10) EMERGENCY DISCLAIMER
// ===================================================
function appendEmergencyDisclaimer() {
    if (!DOM.messagesContainer) return;

    const disclaimerDiv = document.createElement("div");
    disclaimerDiv.className = "message bot-message";
    disclaimerDiv.style.marginTop = "8px";
    disclaimerDiv.innerHTML = `
        <div class="avatar bot-avatar"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i></div>
        <div class="bubble bot-bubble" style="background:#FFF8E7;border-left:4px solid #FFB347;">
            <span class="message-text">⚠️ <strong>Medical Disclaimer:</strong> Healix is an AI assistant, not a doctor. In case of emergency, please contact your local medical services immediately. Always consult a healthcare professional for medical advice.</span>
        </div>
    `;
    DOM.messagesContainer.appendChild(disclaimerDiv);
    scrollToBottom();
}

// ===================================================
// 11) EVENT LISTENERS
// ===================================================
function attachEventListeners() {
    // زر الإرسال
    if (DOM.sendBtn) {
        DOM.sendBtn.addEventListener("click", sendMessage);
    }

    // زر الإرسال داخل الـ form (لو موجود)
    if (DOM.chatForm) {
        DOM.chatForm.addEventListener("submit", (e) => {
            e.preventDefault();
            sendMessage();
        });
    }

    // Enter للإرسال + Shift+Enter لسطر جديد
    if (DOM.userInput) {
        DOM.userInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!STATE.isSending) sendMessage();
            }
        });

        // فحص الطول أثناء الكتابة
        DOM.userInput.addEventListener("input", () => {
            const length = DOM.userInput.value.length;
            if (length > CONFIG.MAX_MESSAGE_LENGTH) {
                DOM.userInput.value = DOM.userInput.value.slice(0, CONFIG.MAX_MESSAGE_LENGTH);
            }
        });
    }

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

    // اختصارات لوحة المفاتيح
    document.addEventListener("keydown", (e) => {
        // Ctrl/Cmd + K = تركيز على الإدخال
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
            e.preventDefault();
            focusInput();
        }
        // Esc = إلغاء الطلب الحالي
        if (e.key === "Escape" && STATE.isSending && STATE.abortController) {
            STATE.abortController.abort();
        }
    });
}

// ===================================================
// 12) INITIALIZATION
// ===================================================
function init() {
    // فحص وجود العناصر الأساسية
    if (!DOM.messagesContainer || !DOM.userInput || !DOM.sendBtn) {
        console.error("Healix AI: Required DOM elements not found.");
        return;
    }

    attachEventListeners();
    initVoiceInput();
    focusInput();
    scrollToBottom(false);

    // Disclaimer بعد لحظة بسيطة
    setTimeout(appendEmergencyDisclaimer, 400);
}

// ===================================================
// 13) BOOTSTRAP
// ===================================================
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
