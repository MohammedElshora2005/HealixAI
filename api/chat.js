// ===================================================
// HEALIX AI - BACKEND API
// api/chat.js
// Enhanced Version v2.0
// ===================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// تحميل المتغيرات البيئية
dotenv.config();

const app = express();

// ===================================================
// 1) MIDDLEWARE
// ===================================================

// CORS - يُفضّل تحديد الدومينات المسموح لها في الإنتاج
const corsOptions = {
    origin: [
        'https://healix-ai-phi.vercel.app',
        /\.vercel\.app$/,
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false
};
app.use(cors(corsOptions));

// Body parser مع حد أقصى للحجم
app.use(express.json({ limit: '50kb' }));

// إزالة ترويسة X-Powered-By (أمان)
app.disable('x-powered-by');

// ===================================================
// 2) CONFIGURATION
// ===================================================

const CONFIG = {
    GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
    // ✅ الموديل الجديد (القديم اتوقف)
    MODEL: 'openai/gpt-oss-20b',
    TEMPERATURE: 0.3,
    MAX_TOKENS: 1024,
    TIMEOUT_MS: 25000,
    MAX_MESSAGE_LENGTH: 2000,
    SYSTEM_PROMPT: `You are Healix, a highly professional and compassionate Medical AI Assistant.

STRICT RULES:
1. ONLY answer questions related to health, medicine, symptoms, medications, and wellness.
2. If the user asks about non-medical topics (e.g., coding, sports, history, jokes, politics), politely explain that you are a specialized medical assistant and cannot answer.
3. Always provide helpful but cautious medical advice. Remind the user to consult a human doctor for diagnosis or treatment.
4. If symptoms suggest an emergency (chest pain, difficulty breathing, severe bleeding, stroke signs, etc.), IMMEDIATELY advise the user to call emergency services.
5. Never prescribe specific drug dosages.
6. Reply in the same language the user uses (Arabic or English).
7. Be concise but thorough. Use bullet points for lists when helpful.
8. Never make up facts. If unsure, say so and recommend consulting a professional.`
};

// ===================================================
// 3) HELPER FUNCTIONS
// ===================================================

/**
 * التحقق من صحة الرسالة الواردة
 */
function validateMessage(message) {
    if (typeof message !== 'string') {
        return { valid: false, error: 'Message must be a string.' };
    }
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'Message cannot be empty.' };
    }
    if (trimmed.length > CONFIG.MAX_MESSAGE_LENGTH) {
        return { valid: false, error: `Message too long (max ${CONFIG.MAX_MESSAGE_LENGTH} characters).` };
    }
    return { valid: true, message: trimmed };
}

/**
 * fetch مع timeout
 */
async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// ===================================================
// 4) ROUTES
// ===================================================

// Health check
app.get('/api/chat', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Healix AI Backend',
        model: CONFIG.MODEL,
        timestamp: new Date().toISOString()
    });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        // ✅ 1) فحص وجود مفتاح API
        if (!process.env.GROQ_API_KEY) {
            console.error('❌ GROQ_API_KEY is not set in environment variables.');
            return res.status(500).json({
                error: {
                    message: 'Server configuration error. Please contact the administrator.',
                    code: 'missing_api_key'
                }
            });
        }

        // ✅ 2) التحقق من الرسالة
        const validation = validateMessage(req.body?.message);
        if (!validation.valid) {
            return res.status(400).json({
                error: {
                    message: validation.error,
                    code: 'invalid_input'
                }
            });
        }

        const userMessage = validation.message;

        // ✅ 3) استدعاء Groq API
        const groqResponse = await fetchWithTimeout(
            CONFIG.GROQ_API_URL,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: CONFIG.MODEL,
                    messages: [
                        { role: 'system', content: CONFIG.SYSTEM_PROMPT },
                        { role: 'user', content: userMessage }
                    ],
                    temperature: CONFIG.TEMPERATURE,
                    max_tokens: CONFIG.MAX_TOKENS,
                    stream: false
                })
            },
            CONFIG.TIMEOUT_MS
        );

        // ✅ 4) فحص حالة الاستجابة
        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            console.error('❌ Groq API Error:', groqResponse.status, errorText);

            // رسائل مخصصة حسب نوع الخطأ
            let userMessage = 'AI service is currently unavailable. Please try again later.';
            let code = 'groq_error';

            if (groqResponse.status === 401) {
                userMessage = 'Authentication failed with AI service.';
                code = 'auth_error';
            } else if (groqResponse.status === 429) {
                userMessage = 'Too many requests. Please wait a moment and try again.';
                code = 'rate_limit';
            } else if (groqResponse.status === 404) {
                userMessage = 'AI model not available. Please contact support.';
                code = 'model_not_found';
            }

            return res.status(groqResponse.status).json({
                error: { message: userMessage, code }
            });
        }

        // ✅ 5) قراءة الرد
        const data = await groqResponse.json();

        // ✅ 6) التحقق من شكل الرد
        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            console.error('❌ Unexpected Groq response shape:', data);
            return res.status(502).json({
                error: {
                    message: 'AI returned an unexpected response. Please try again.',
                    code: 'invalid_response'
                }
            });
        }

        // ✅ 7) إرسال الرد للفرونت إند
        res.json({
            choices: data.choices,
            model: data.model,
            usage: data.usage
        });

    } catch (error) {
        // معالجة الأخطاء المختلفة
        if (error.name === 'AbortError') {
            console.error('❌ Request timeout');
            return res.status(504).json({
                error: {
                    message: 'Request timed out. The AI is taking too long to respond.',
                    code: 'timeout'
                }
            });
        }

        console.error('❌ Server Error:', error);
        res.status(500).json({
            error: {
                message: 'Internal server error. Please try again.',
                code: 'internal_error'
            }
        });
    }
});

// ===================================================
// 5) FALLBACK ROUTES
// ===================================================

// 404 للمسارات غير المعروفة
app.use((req, res) => {
    res.status(404).json({
        error: {
            message: `Route ${req.method} ${req.path} not found.`,
            code: 'not_found'
        }
    });
});

// Error handler عام
app.use((err, req, res, next) => {
    console.error('❌ Unhandled Error:', err);
    res.status(500).json({
        error: {
            message: 'Unexpected server error.',
            code: 'unhandled_error'
        }
    });
});

// ===================================================
// 6) EXPORT (Vercel Serverless)
// ===================================================
module.exports = app;
