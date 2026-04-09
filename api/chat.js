const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// في Vercel، الـ Environment Variables بتتقري أوتوماتيك، بس بنسيب دي للأمان
dotenv.config();

const app = express();

// إعدادات الـ CORS عشان تسمح للموقع يكلم السيرفر
app.use(cors());
app.use(express.json());

// المار الرئيسي (Endpoint)
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;

        // التأكد من وجود مفتاح الـ API
        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: "Missing GROQ_API_KEY in environment variables" });
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
                    { "role": "system", "content": "You are Healix, a compassionate medical AI." },
                    { "role": "user", "content": userMessage }
                ],
                temperature: 0.25
            })
        });

        const data = await response.json();
        
        // إرجاع النتيجة للمتصفح
        res.json(data); 
        
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// السطر السحري اللي بيخلي Vercel يشغل السيرفر صح
module.exports = app;
