# 5ire-NG

<p align="center">
  <a href="https://github.com/LiterallyBlah/5ire-ng">
    <img src="https://5ire.app/logo.png" alt="Logo" width="120">
  </a>
  <br />
   <h1>5ire AI Assistant with Ollama Integration</h1>
   <div>
     <img src="https://img.shields.io/badge/licence-GNUv3-brightgreen.svg?style=flat"/>
     <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/>
  </div>
  <br />
</p>

## 🚀 About 5ire-NG
5ire-NG is a fork of the 5ire AI assistant that adds **local model support through Ollama integration**. Building upon the original [5ire](https://github.com/nanbingxyz/5ire), this version focuses on providing a seamless experience whilst working with local AI models.

## 🎯 Features

### 🔄 Ollama Model Integration
- **Auto-detection of local Ollama models** – no manual configuration required
- **Simple model switching** via dropdown in the chat UI
- **Streamlined chat experience** with local AI models
- **Dynamic tool support detection** (green indicator for supported tools)
- **Sync button** for model state synchronisation

### 📖 Core 5ire Features
- All the original features from 5ire, including:
  - Conversation management
  - Basic chat functionality
  - Simple and intuitive UI
  - Knowledge base
  - Prompt library
  - Many more models
  - Bookmarks

## 📦 Development Installation

1. **Prerequisites:**
   - Node.js (v18+) and npm
   - Git
   - For Windows: Visual Studio Code Build Tools
   - npx (comes with Node.js/npm installation)
   - uv package manager:
     # macOS
     brew install uv

     # Windows (PowerShell)
     powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

     # Linux/WSL
     curl -LsSf https://astral.sh/uv/install.sh | sh

2. **Clone the repository:**
   ```bash
   git clone https://github.com/LiterallyBlah/5ire-ng.git
   cd 5ire-ng
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory with the following content:
   ```
   SUPA_PROJECT_ID="your-supabase-project-id"
   SUPA_KEY="your-supabase-api-key"
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Run the application:**
   ```bash
   npm run start:renderer
   ```

The application should now be running in development mode.

## 🛠️ Roadmap

### ✅ Completed
- **Ollama Model Integration**  
  - Local Ollama models auto-detection
  - Model selection via dropdown in chat UI
  - Dynamic tool support detection (green indicator for supported tools)
  - Sync button for model state synchronisation
  - Tool support for private operations

### 🔄 In Progress
- **MCP Improvements**
  - Add MCP via the frontend
  - Show tool input and output in the chat interface

### 🚀 Planned Features
- **Enhanced Model Compatibility**
  - Enhanced thinking model compatibility
- **UI Improvements**
  - Enhanced model selection interface
  - Better error feedback
  - Improved chat experience
  - Call tools directly from the chat interface (with a '/<tool\>')
- **AI Agents**
  - Add support for AI Agents
  - Call agents in the chat interface
- **Voice Integration**
  - Add support for voice input and output

## 🤝 Contributing
Contributions are welcome! Feel free to submit PRs or issues to help improve the project.

## 📝 Credits
This project is based on [5ire](https://github.com/nanbingxyz/5ire). Credit goes to the original authors for their work on the initial AI assistant.

## 📜 Licence
5ire-NG is licensed under the **GNU General Public Licence v3.0**.

---

> **Note:** This project is currently in active development, focusing primarily on Ollama integration.
