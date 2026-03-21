# 🔗 MyApi MCP (Model Context Protocol) Setup

Enable Claude, Cursor, VS Code, and other AI clients to access your MyApi unified OAuth services.

---

## 🚀 What This Enables

Once configured, Claude can:

✅ **List your connected services** - "What services do I have connected?"  
✅ **Search across platforms** - "Search my emails and Google Drive for 'project X'"  
✅ **Read data from services** - "Show me my calendar for next week"  
✅ **Execute service methods** - "Send an email to...," "Create a calendar event"  
✅ **Get vault summary** - "What data do I have in MyApi?"  

**Example conversation:**
```
You: "Search my Gmail and Drive for emails about the MyApi launch"
Claude: [searches both services via MCP]
Claude: "Found 12 emails and 3 documents about MyApi"
```

---

## 📋 Prerequisites

- Node.js 18+
- MyApi repository cloned
- OAuth services connected to your MyApi account

---

## 🔧 Installation

### **Step 1: Install MCP Dependencies**

```bash
cd /opt/MyApi

npm install @modelcontextprotocol/sdk
```

### **Step 2: Verify MCP Server Works Locally**

```bash
# Test the server
MYAPI_USER_ID="usr_YOUR_USER_ID" node src/mcp-server.js
```

You should see:
```
[MCP] User context set: usr_YOUR_USER_ID
[MCP] MyApi server started and connected
```

---

## 🤖 Configure for Claude Desktop

### **On macOS:**

1. Open/create: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "myapi": {
      "command": "node",
      "args": ["/opt/MyApi/src/mcp-server.js"],
      "env": {
        "MYAPI_USER_ID": "usr_c83f2b59ac4016a1074cbe220a677cfc"
      }
    }
  }
}
```

2. Restart Claude Desktop

3. Look for **🔗 MyApi** in Claude's tools panel (bottom left)

### **On Windows:**

1. Open: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the same config (adjust path for Windows):

```json
{
  "mcpServers": {
    "myapi": {
      "command": "node",
      "args": ["C:\\path\\to\\MyApi\\src\\mcp-server.js"],
      "env": {
        "MYAPI_USER_ID": "usr_c83f2b59ac4016a1074cbe220a677cfc"
      }
    }
  }
}
```

3. Restart Claude Desktop

### **On Linux:**

1. Open: `~/.config/Claude/claude_desktop_config.json`

2. Add the config (same as macOS)

---

## 🖥️ Configure for VS Code + GitHub Copilot

1. Install **GitHub Copilot** extension

2. Open VS Code Settings (Cmd+,)

3. Search for **MCP Servers**

4. Add MyApi:

```json
{
  "github.copilot.codeium.modelContextProtocol": [
    {
      "name": "myapi",
      "command": "node",
      "args": ["/opt/MyApi/src/mcp-server.js"],
      "env": {
        "MYAPI_USER_ID": "usr_c83f2b59ac4016a1074cbe220a677cfc"
      }
    }
  ]
}
```

5. Restart VS Code

---

## 🎯 Configure for Cursor IDE

1. Open: `~/.cursor/settings/settings.json`

2. Add to `mcp`:

```json
{
  "mcp": {
    "myapi": {
      "command": "node",
      "args": ["/opt/MyApi/src/mcp-server.js"],
      "env": {
        "MYAPI_USER_ID": "usr_c83f2b59ac4016a1074cbe220a677cfc"
      }
    }
  }
}
```

3. Restart Cursor

---

## ✅ Verify Configuration

### **In Claude Desktop:**

1. Open Claude
2. Look for **🔗** icon (tools) in bottom left
3. Should see **myapi** listed
4. Try: "What services do I have connected?"

### **Expected Response:**

```
Connected Services (8):

• discord
• github
• github
• linkedin
• google
• notion
• slack
• fal
```

---

## 🔐 Security Notes

### **User ID**
- Get your user ID from MyApi dashboard
- Or query: `SELECT id FROM users WHERE email = 'your@email.com'`
- Keep this secret - don't share configs with your user ID

### **Token Access**
- MCP server reads encrypted tokens from your database
- Tokens are never exposed to Claude
- All operations stay within your infrastructure

### **Isolation**
- Each MCP client gets only YOUR data (scoped by MYAPI_USER_ID)
- Multiple users = multiple config files with different user IDs

---

## 🧪 Testing Tools

### **List Services**
```
"What OAuth services am I connected to?"
```

**Response:**
```
Connected Services (8):
• discord
• github
• linkedin
• google
```

### **Search Services**
```
"Search my Gmail and Drive for emails about OAuth"
```

**Response:**
```
Search Results for "OAuth":
gmail: Found 3 results for "OAuth"
drive: Found 2 results for "OAuth"
```

### **Get Summary**
```
"Give me a summary of my MyApi vault"
```

**Response:**
```
MyApi Vault Summary:

Connected Services: 8

Service Details:
• discord: 1 token(s)
• github: 1 token(s)
• linkedin: 1 token(s)
• google: 1 token(s)
```

---

## 🐛 Troubleshooting

### **MCP Not Showing in Claude**

1. Check config path:
   - macOS: `~/.config/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Verify JSON syntax (use jsonlint.com)

3. Restart Claude completely (quit + reopen)

4. Check system error log:
   ```bash
   tail -f ~/.claude/logs/claude.log
   ```

### **"No user context" Error**

- Verify `MYAPI_USER_ID` environment variable is set
- Get correct ID: `sqlite3 src/data/myapi.db "SELECT id FROM users LIMIT 1"`

### **Permission Denied**

- Verify MyApi database file is readable:
  ```bash
  ls -la /path/to/MyApi/src/data/myapi.db
  ```

---

## 📚 Available MCP Tools

Once configured, Claude has access to:

| Tool | Description |
|------|-------------|
| `list_services` | List all connected OAuth services |
| `get_service_data` | Fetch data from a service (emails, files, etc) |
| `execute_service_method` | Execute actions on a service |
| `get_oauth_status` | Check connection status |
| `search_all_services` | Search across multiple services |
| `get_vault_summary` | Overview of all data in vault |

---

## 🚀 Next Steps

1. ✅ Install MCP dependencies
2. ✅ Test locally: `MYAPI_USER_ID="..." node src/mcp-server.js`
3. ✅ Add config to Claude/Cursor/VS Code
4. ✅ Restart the application
5. ✅ Ask Claude about your services!

---

## 📞 Questions?

- **MCP Docs:** https://modelcontextprotocol.io
- **MyApi Issues:** Check src/mcp-server.js logs
- **Claude Issues:** Check Claude's error panel

---

**Your AI assistants now have access to your unified data!** 🎉
