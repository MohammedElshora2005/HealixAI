const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// تفعيل قراءة المتغيرات البيئية
dotenv.config();

const app = express();

// إعدادات CORS للسماح بالوصول من المتصفح
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;

        // التأكد من وجود مفتاح الـ API في إعدادات Vercel
        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: "Missing GROQ_API_KEY" });
        }

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        "role": "system", 
                        "content": `You are Healix, a highly professional and compassionate Medical AI Assistant. 
                        STRICT RULES:
                        1. ONLY answer questions related to health, medicine, symptoms, and wellness.
                        2. If the user asks about non-medical topics (e.g., coding, sports, history, jokes), politely explain that you are a specialized medical assistant and cannot answer.
                        3. Always provide helpful but cautious medical advice, reminding the user to consult a human doctor.
                        4. Reply in the same language the user uses (Arabic or English).` 
                    },
                    { "role": "user", "content": userMessage }
                ],
                temperature: 0.3 // لضمان إجابات دقيقة وغير عشوائية
            })
        });

        const data = await response.json();
        res.json(data); 
        
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// تصدير التطبيق ليعمل كـ Serverless Function على Vercel
module.exports = app;
