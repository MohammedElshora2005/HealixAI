Healix AI - Medical Assistant Chatbot
Healix is an intelligent medical assistant powered by AI (Llama 3.1 via Groq API). It is designed to provide compassionate health-related information through a modern, responsive web interface. The project utilizes a secure Node.js backend to ensure API keys remain protected.

🚀 Features
Secure Backend: Uses a Node.js/Express proxy server to hide the API Key from the client-side.

Modern UI: Clean, medical-themed interface with responsive design.

Voice Recognition: Integrated Web Speech API for hands-free interaction.

Real-time Interaction: Smooth typing indicators and instant message rendering.

Safety Disclaimer: Built-in medical warnings to ensure responsible AI usage.

🛠️ Tech Stack
Frontend: HTML5, CSS3, JavaScript (Vanilla).

Backend: Node.js, Express.js.

API: Groq Cloud API.

Environment Management: Dotenv for secure configuration.

📂 Project Structure
Plaintext
├── ChatBot_Doc.html   # The main UI structure
├── ChatBot_Doc.css    # Styling and layout
├── ChatBot_Doc.js     # Frontend logic and voice integration
├── server.js          # Secure Node.js backend server
├── package.json       # Project metadata and dependencies
├── .gitignore         # Rules to exclude sensitive files (node_modules, .env)
└── .env               # (Local only) API Key storage
⚙️ Setup & Installation
Clone the repository:

Bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
Install dependencies:
Navigate to the project folder and run:

Bash
npm install
Configure API Key:
Create a .env file in the root directory and add your Groq API key:

Plaintext
GROQ_API_KEY=your_actual_api_key_here
Run the Server:

Bash
node server.js
Launch the Chatbot:
Simply open ChatBot_Doc.html in your favorite web browser.

🔒 Security Note
This project follows industry best practices by utilizing a backend server to handle API requests. The sensitive .env file and the node_modules directory are excluded from the repository via .gitignore to prevent unauthorized access to API credentials.
