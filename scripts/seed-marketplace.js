#!/usr/bin/env node
/**
 * Marketplace Seed Script — Official AI Company Skills
 * Clears all existing listings and populates with genuine SKILL.md-based skills
 * from Anthropic (anthropics/skills) and curated skills from other AI providers.
 *
 * Usage: node scripts/seed-marketplace.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Database = require('better-sqlite3');
const DB_PATH = process.env.DB_PATH || '/opt/MyApi/data/myapi.db';

const db = new Database(DB_PATH);
const now = new Date().toISOString();

// ---------------------------------------------------------------------------
// ANTHROPIC OFFICIAL SKILLS (from github.com/anthropics/skills)
// ---------------------------------------------------------------------------

const ANTHROPIC_SKILLS = [

  {
    title: 'PDF Processing',
    description: 'Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rotating pages, adding watermarks, creating new PDFs, filling PDF forms, encrypting/decrypting PDFs, extracting images, and OCR on scanned PDFs to make them searchable. If the user mentions a .pdf file or asks to produce one, use this skill.',
    tags: 'anthropic,pdf,documents,ocr,extraction,pypdf,pdfplumber,reportlab',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/pdf',
    skill_name: 'pdf',
    category: 'documents',
    script_content: `---
name: pdf
description: Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rotating pages, adding watermarks, creating new PDFs, filling PDF forms, encrypting/decrypting PDFs, extracting images, and OCR on scanned PDFs to make them searchable. If the user mentions a .pdf file or asks to produce one, use this skill.
license: Proprietary. LICENSE.txt has complete terms
---

# PDF Processing Guide

## Overview

This guide covers essential PDF processing operations using Python libraries and command-line tools.

## Quick Start

\`\`\`python
from pypdf import PdfReader, PdfWriter

# Read a PDF
reader = PdfReader("document.pdf")
print(f"Pages: {len(reader.pages)}")

# Extract text
text = ""
for page in reader.pages:
    text += page.extract_text()
\`\`\`

## Python Libraries

### pypdf - Basic Operations

#### Merge PDFs
\`\`\`python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
\`\`\`

#### Split PDF
\`\`\`python
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as output:
        writer.write(output)
\`\`\`

### pdfplumber - Text and Table Extraction

\`\`\`python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        tables = page.extract_tables()
\`\`\`

### reportlab - Create PDFs

\`\`\`python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("hello.pdf", pagesize=letter)
width, height = letter
c.drawString(100, height - 100, "Hello World!")
c.save()
\`\`\`

## Command-Line Tools

\`\`\`bash
# Extract text
pdftotext input.pdf output.txt

# Merge PDFs
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf

# Rotate pages
qpdf input.pdf output.pdf --rotate=+90:1
\`\`\`

## Common Tasks

### OCR Scanned PDFs
\`\`\`python
import pytesseract
from pdf2image import convert_from_path

images = convert_from_path('scanned.pdf')
text = ""
for i, image in enumerate(images):
    text += pytesseract.image_to_string(image)
\`\`\`

Source: https://github.com/anthropics/skills/tree/main/skills/pdf`,
  },

  {
    title: 'PowerPoint / PPTX',
    description: 'Use this skill any time a .pptx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch decks, or presentations; reading, parsing, or extracting text from any .pptx file; editing, modifying, or updating existing presentations; combining or splitting slide files; working with templates, layouts, speaker notes, or comments. Trigger whenever the user mentions "deck," "slides," "presentation," or references a .pptx filename, regardless of what they plan to do with the content afterward.',
    tags: 'anthropic,pptx,powerpoint,presentations,slides,pptxgenjs,markitdown',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/pptx',
    skill_name: 'pptx',
    category: 'documents',
    script_content: `---
name: pptx
description: Use this skill any time a .pptx file is involved in any way — as input, output, or both. This includes creating slide decks, pitch decks, or presentations; reading, parsing, or extracting text from any .pptx file; editing, modifying, or updating existing presentations; working with templates, layouts, speaker notes, or comments. Trigger whenever the user mentions "deck," "slides," "presentation," or references a .pptx filename.
license: Proprietary. LICENSE.txt has complete terms
---

# PPTX Skill

## Quick Reference

| Task | Guide |
|------|-------|
| Read/analyze content | \`python -m markitdown presentation.pptx\` |
| Edit or create from template | Read editing.md |
| Create from scratch | Use pptxgenjs |

## Reading Content

\`\`\`bash
# Text extraction
python -m markitdown presentation.pptx

# Visual overview
python scripts/thumbnail.py presentation.pptx
\`\`\`

## Creating with pptxgenjs

\`\`\`javascript
const pptxgen = require("pptxgenjs");
const prs = new pptxgen();

const slide = prs.addSlide();
slide.addText("Hello World!", { x: 1, y: 1, fontSize: 36, bold: true });

prs.writeFile({ fileName: "sample.pptx" });
\`\`\`

## Design Principles

- Pick a bold, content-informed color palette
- One color should dominate (60-70% visual weight)
- Dark/light contrast: dark for title/conclusion slides
- Commit to a visual motif and repeat it
- Every slide needs a visual element — image, chart, icon, or shape

## Color Palettes

| Theme | Primary | Secondary | Accent |
|-------|---------|-----------|--------|
| Midnight Executive | \`1E2761\` | \`CADCFC\` | \`FFFFFF\` |
| Forest & Moss | \`2C5F2D\` | \`97BC62\` | \`F5F5F5\` |
| Coral Energy | \`F96167\` | \`F9E795\` | \`2F3C7E\` |
| Charcoal Minimal | \`36454F\` | \`F2F2F2\` | \`212121\` |

## QA (Required)

\`\`\`bash
# Content check
python -m markitdown output.pptx

# Check for placeholder text
python -m markitdown output.pptx | grep -iE "xxxx|lorem|ipsum"

# Convert to images for visual QA
python scripts/office/soffice.py --headless --convert-to pdf output.pptx
pdftoppm -jpeg -r 150 output.pdf slide
\`\`\`

Source: https://github.com/anthropics/skills/tree/main/skills/pptx`,
  },

  {
    title: 'Excel / XLSX Spreadsheets',
    description: 'Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or fix an existing .xlsx, .xlsm, .csv, or .tsv file; create a new spreadsheet from scratch or from other data sources; or convert between tabular file formats. Trigger especially when the user references a spreadsheet file by name or path, and wants something done to it or produced from it.',
    tags: 'anthropic,xlsx,excel,spreadsheets,openpyxl,pandas,csv,financial-models',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/xlsx',
    skill_name: 'xlsx',
    category: 'documents',
    script_content: `---
name: xlsx
description: Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to open, read, edit, or fix an existing .xlsx, .xlsm, .csv, or .tsv file; create a new spreadsheet; or convert between tabular file formats. Trigger when the user references a spreadsheet file by name or wants something done to it.
license: Proprietary. LICENSE.txt has complete terms
---

# XLSX Skill

## Overview

A user may ask you to create, edit, or analyze the contents of an .xlsx file.

## Reading and Analyzing Data

\`\`\`python
import pandas as pd

# Read Excel
df = pd.read_excel('file.xlsx')  # Default: first sheet
all_sheets = pd.read_excel('file.xlsx', sheet_name=None)  # All sheets as dict

# Analyze
df.head()      # Preview data
df.info()      # Column info
df.describe()  # Statistics

# Write Excel
df.to_excel('output.xlsx', index=False)
\`\`\`

## CRITICAL: Use Formulas, Not Hardcoded Values

\`\`\`python
# BAD: Hardcoding calculated values
sheet['B10'] = 5000  # Don't do this

# GOOD: Let Excel calculate
sheet['B10'] = '=SUM(B2:B9)'
sheet['C5'] = '=(C4-C2)/C2'
sheet['D20'] = '=AVERAGE(D2:D19)'
\`\`\`

## Creating Excel Files with openpyxl

\`\`\`python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
sheet = wb.active

sheet['A1'] = 'Revenue'
sheet['B1'] = '=SUM(B2:B12)'

# Blue = hardcoded inputs, Black = formulas (industry standard)
sheet['A1'].font = Font(bold=True)
sheet.column_dimensions['A'].width = 20

wb.save('output.xlsx')
\`\`\`

## Recalculate Formulas (MANDATORY)

\`\`\`bash
python scripts/recalc.py output.xlsx
\`\`\`

## Financial Model Color Standards

- **Blue text**: Hardcoded inputs users will change
- **Black text**: All formulas and calculations
- **Green text**: Links from other worksheets
- **Yellow background**: Key assumptions needing attention

Source: https://github.com/anthropics/skills/tree/main/skills/xlsx`,
  },

  {
    title: 'Word / DOCX Documents',
    description: 'Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files). Triggers include: any mention of "Word doc", ".docx", or requests to produce professional documents with formatting like tables of contents, headings, page numbers, or letterheads. Also use when extracting or reorganizing content from .docx files, inserting or replacing images, working with tracked changes or comments, or converting content into a polished Word document.',
    tags: 'anthropic,docx,word,documents,pandoc,python-docx,tracked-changes',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/docx',
    skill_name: 'docx',
    category: 'documents',
    script_content: `---
name: docx
description: Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files). Triggers include any mention of "Word doc", ".docx", or requests to produce professional documents with formatting like tables of contents, headings, page numbers, or letterheads.
license: Proprietary. LICENSE.txt has complete terms
---

# DOCX Creation, Editing, and Analysis

## Overview

A .docx file is a ZIP archive containing XML files.

## Quick Reference

| Task | Approach |
|------|----------|
| Read/analyze content | pandoc or unpack for XML |
| Edit or create with formatting | python-docx or docx.js |
| Advanced XML manipulation | Unpack ZIP, edit XML, repack |

## Reading Content

\`\`\`bash
# Extract text with pandoc
pandoc input.docx -t plain -o output.txt

# Convert to markdown
pandoc input.docx -t markdown -o output.md
\`\`\`

## Creating with python-docx

\`\`\`python
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Title
title = doc.add_heading('Report Title', 0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Body
doc.add_paragraph('Introduction paragraph...')

# Table
table = doc.add_table(rows=3, cols=3)
table.style = 'Table Grid'
for i, row in enumerate(table.rows):
    for j, cell in enumerate(row.cells):
        cell.text = f'Row {i}, Col {j}'

doc.save('output.docx')
\`\`\`

## Editing Existing Documents

\`\`\`python
from docx import Document

doc = Document('existing.docx')

# Find and replace text
for paragraph in doc.paragraphs:
    if 'old text' in paragraph.text:
        for run in paragraph.runs:
            run.text = run.text.replace('old text', 'new text')

doc.save('modified.docx')
\`\`\`

## Tracked Changes and Comments

For tracked changes, work directly with the XML:

\`\`\`python
import zipfile
import shutil
from lxml import etree

# Unpack
shutil.unpack_archive('document.docx', 'unpacked/', 'zip')

# Edit document.xml
tree = etree.parse('unpacked/word/document.xml')
# ... XML manipulation ...

# Repack
shutil.make_archive('output', 'zip', 'unpacked/')
import os; os.rename('output.zip', 'output.docx')
\`\`\`

Source: https://github.com/anthropics/skills/tree/main/skills/docx`,
  },

  {
    title: 'Claude API Development',
    description: 'Build apps with the Claude API or Anthropic SDK. TRIGGER when: code imports `anthropic`/`@anthropic-ai/sdk`/`claude_agent_sdk`, or user asks to use Claude API, Anthropic SDKs, or Agent SDK. DO NOT TRIGGER when: code imports `openai`/other AI SDK, general programming, or ML/data-science tasks.',
    tags: 'anthropic,claude-api,sdk,llm,tool-use,streaming,agent-sdk,mcp',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/claude-api',
    skill_name: 'claude-api',
    category: 'ai',
    script_content: `---
name: claude-api
description: Build apps with the Claude API or Anthropic SDK. TRIGGER when code imports anthropic/@anthropic-ai/sdk/claude_agent_sdk, or user asks to use Claude API, Anthropic SDKs, or Agent SDK. DO NOT TRIGGER when code imports openai/other AI SDK, general programming, or ML/data-science tasks.
license: Proprietary. LICENSE.txt has complete terms
---

# Building LLM-Powered Applications with Claude

## Model Selection

| Model | Best For |
|-------|----------|
| claude-opus-4-6 | Complex reasoning, research, analysis |
| claude-sonnet-4-6 | Balanced performance/cost, most tasks |
| claude-haiku-4-5 | Speed-critical, high-volume, simple tasks |

## Basic Usage (Python)

\`\`\`python
import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello, Claude!"}]
)
print(message.content[0].text)
\`\`\`

## Streaming

\`\`\`python
with client.messages.stream(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a haiku"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
\`\`\`

## Tool Use

\`\`\`python
tools = [{
    "name": "get_weather",
    "description": "Get current weather for a location",
    "input_schema": {
        "type": "object",
        "properties": {
            "location": {"type": "string", "description": "City name"}
        },
        "required": ["location"]
    }
}]

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "What's the weather in Paris?"}]
)
\`\`\`

## Extended Thinking

\`\`\`python
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 10000},
    messages=[{"role": "user", "content": "Solve this complex problem..."}]
)
\`\`\`

## TypeScript / Node.js

\`\`\`typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello!" }]
});
\`\`\`

## Claude Agent SDK

\`\`\`python
from claude_agent_sdk import Agent, Tool

agent = Agent(
    model="claude-sonnet-4-6",
    tools=[my_tool],
    system_prompt="You are a helpful assistant."
)

result = await agent.run("Analyze this codebase and summarize")
\`\`\`

Source: https://github.com/anthropics/skills/tree/main/skills/claude-api`,
  },

  {
    title: 'Frontend Design',
    description: 'Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.',
    tags: 'anthropic,frontend,design,react,html,css,tailwind,ui,ux,web',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/frontend-design',
    skill_name: 'frontend-design',
    category: 'design',
    script_content: `---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications. Generates creative, polished code and UI design that avoids generic AI aesthetics.
license: Proprietary. LICENSE.txt has complete terms
---

# Frontend Design Skill

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and interaction design.

## Core Principles

### Avoid Generic AI Aesthetics
- No default blue buttons with rounded corners
- No generic card layouts with drop shadows
- No "purple gradient startup" look
- Avoid predictable layouts that look like every other AI-generated UI

### Design Philosophy
- **Intentional**: Every design decision serves the content
- **Distinctive**: Creates a memorable, unique visual identity
- **Production-grade**: Code that works in a real application
- **Accessible**: WCAG 2.1 AA compliant by default

## Typography

Choose interesting, opinionated font pairings:

\`\`\`css
/* Option 1: Editorial */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Serif+4:ital,wght@0,400;1,400&display=swap');

/* Option 2: Technical */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;700&family=JetBrains+Mono&display=swap');

/* Option 3: Warm humanist */
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;1,400&family=DM+Sans:wght@400;500&display=swap');
\`\`\`

## Color Systems

Build a 3-token color system (background, foreground, accent) instead of generic palette:

\`\`\`css
:root {
  --bg: #0D0D0D;       /* Near black — creates depth */
  --fg: #F5F0E8;       /* Warm white — not harsh */
  --accent: #E85D04;   /* Specific, memorable orange */
  --muted: #666666;    /* Supporting text */
}
\`\`\`

## Layout Patterns

### Asymmetric grids over symmetric ones
\`\`\`css
.hero {
  display: grid;
  grid-template-columns: 3fr 1fr;  /* Tension in proportion */
  gap: 2rem;
}
\`\`\`

### Purposeful whitespace
\`\`\`css
.section {
  padding: clamp(4rem, 10vw, 12rem) 0;  /* Breathing room scales with viewport */
}
\`\`\`

## Interaction Design

\`\`\`css
/* Subtle, purposeful transitions */
.button {
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.button:hover { transform: translateY(-2px); }
.button:active { transform: translateY(0); }

/* Micro-animations that communicate state */
@keyframes reveal {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
\`\`\`

## React Components

\`\`\`jsx
// Prefer composition over configuration
function Card({ variant = 'default', children, className }) {
  return (
    <div className={\`card card--\${variant} \${className}\`}>
      {children}
    </div>
  );
}

// Not: <Card title="..." description="..." image="..." button="..." />
// But: <Card><Card.Image /><Card.Body><Card.Title /></Card.Body></Card>
\`\`\`

Source: https://github.com/anthropics/skills/tree/main/skills/frontend-design`,
  },

  {
    title: 'MCP Server Builder',
    description: 'Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).',
    tags: 'anthropic,mcp,model-context-protocol,tools,api-integration,typescript,python,fastmcp',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/mcp-builder',
    skill_name: 'mcp-builder',
    category: 'development',
    script_content: `---
name: mcp-builder
description: Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).
license: Proprietary. LICENSE.txt has complete terms
---

# MCP Server Development Guide

## Overview

Create MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools.

## Python (FastMCP)

\`\`\`python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("My Service")

@mcp.tool()
def search_documents(query: str, limit: int = 10) -> list[dict]:
    """Search documents by query string.

    Args:
        query: The search query
        limit: Maximum number of results (default: 10)

    Returns:
        List of matching documents with id, title, and snippet
    """
    # Implementation here
    return results

@mcp.resource("config://settings")
def get_settings() -> str:
    """Get current application settings"""
    return json.dumps(settings)

if __name__ == "__main__":
    mcp.run()
\`\`\`

## TypeScript (MCP SDK)

\`\`\`typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-service", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "search",
    description: "Search for documents",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" }
      },
      required: ["query"]
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search") {
    const { query } = request.params.arguments;
    const results = await performSearch(query);
    return {
      content: [{ type: "text", text: JSON.stringify(results) }]
    };
  }
  throw new Error("Tool not found");
});

const transport = new StdioServerTransport();
await server.connect(transport);
\`\`\`

## Tool Design Principles

1. **Single responsibility**: Each tool does one thing well
2. **Clear descriptions**: LLMs use descriptions to decide when to call tools
3. **Typed parameters**: Use JSON Schema with descriptions for each parameter
4. **Error handling**: Return clear error messages, not stack traces
5. **Idempotency**: Tools called multiple times should be safe

## Configuration (claude_desktop_config.json)

\`\`\`json
{
  "mcpServers": {
    "my-service": {
      "command": "python",
      "args": ["/path/to/server.py"],
      "env": { "API_KEY": "your-key" }
    }
  }
}
\`\`\`

## Testing

\`\`\`bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector python server.py

# Unit test
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("test")
# ... register tools ...
result = await mcp.call_tool("search", {"query": "test"})
\`\`\`

Source: https://github.com/anthropics/skills/tree/main/skills/mcp-builder`,
  },

  {
    title: 'Web App Testing (Playwright)',
    description: 'Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.',
    tags: 'anthropic,playwright,testing,browser,automation,screenshots,e2e',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/webapp-testing',
    skill_name: 'webapp-testing',
    category: 'testing',
    script_content: `---
name: webapp-testing
description: Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.
license: Proprietary. LICENSE.txt has complete terms
---

# Web Application Testing

To test local web applications, write native Python Playwright scripts.

## Decision Tree

1. Does a server need to start? → Use \`scripts/with_server.py\`
2. Is it a static HTML file? → Open directly with \`page.goto("file://...")\`
3. Is a dev server already running? → Connect directly

## Basic Playwright Script

\`\`\`python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.goto("http://localhost:3000")

    # Take screenshot
    page.screenshot(path="screenshot.png")

    # Interact with elements
    page.click("button#submit")
    page.fill("input[name='email']", "test@example.com")

    # Assert content
    assert page.locator("h1").text_content() == "Welcome"

    # Get console logs
    page.on("console", lambda msg: print(f"Console: {msg.text}"))

    browser.close()
\`\`\`

## With Server Management

\`\`\`python
# scripts/with_server.py manages server lifecycle
import subprocess
import time
from playwright.sync_api import sync_playwright

# Start dev server
server = subprocess.Popen(["npm", "run", "dev"], stdout=subprocess.PIPE)
time.sleep(2)  # Wait for server to start

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:5173")
        # ... tests ...
        browser.close()
finally:
    server.terminate()
\`\`\`

## Common Patterns

\`\`\`python
# Wait for element
page.wait_for_selector(".loading", state="hidden")
page.wait_for_load_state("networkidle")

# Capture network requests
requests = []
page.on("request", lambda req: requests.append(req.url))

# Mobile viewport
page.set_viewport_size({"width": 375, "height": 667})
context = browser.new_context(
    viewport={"width": 375, "height": 667},
    user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0...)"
)

# Form submission
page.fill("input[name='username']", "testuser")
page.fill("input[name='password']", "password")
page.click("button[type='submit']")
page.wait_for_url("**/dashboard")
\`\`\`

## Debugging

\`\`\`bash
# Run with headed browser (see the browser)
PWDEBUG=1 python test.py

# Slow motion
browser = p.chromium.launch(slow_mo=500)

# Record video
context = browser.new_context(record_video_dir="videos/")
\`\`\`

Source: https://github.com/anthropics/skills/tree/main/skills/webapp-testing`,
  },

  {
    title: 'Algorithmic Art (p5.js)',
    description: 'Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems. Create original algorithmic art rather than copying existing artists\' work to avoid copyright violations.',
    tags: 'anthropic,algorithmic-art,p5js,generative-art,creative-coding,interactive,canvas',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/algorithmic-art',
    skill_name: 'algorithmic-art',
    category: 'creative',
    script_content: `---
name: algorithmic-art
description: Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems.
license: Proprietary. LICENSE.txt has complete terms
---

# Algorithmic Art

Algorithmic philosophies are computational aesthetic movements that are then expressed through code. Output .md files (philosophy), .html files (interactive viewer), and .js files (generative algorithms).

## Two-Step Process

### Step 1: Define Philosophy (philosophy.md)

Write a philosophy document describing the aesthetic movement:

\`\`\`markdown
# Erosion Fields

Mathematical metaphor for geological time — surfaces worn by invisible forces.
Forms emerge not from design but from resistance to entropy.

## Principles
- Forces act invisibly; only effects are visible
- Repetition with drift creates the illusion of intention
- Monochrome reveals structure hidden by color
\`\`\`

### Step 2: Express as Interactive p5.js

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
</head>
<body>
<script>
// Seeded randomness for reproducibility
let seed = 42;

function setup() {
  createCanvas(800, 800);
  background(10);
  randomSeed(seed);
  noiseSeed(seed);
}

function draw() {
  // Flow field example
  let x = random(width);
  let y = random(height);

  for (let i = 0; i < 200; i++) {
    let angle = noise(x * 0.003, y * 0.003) * TWO_PI * 2;
    let vx = cos(angle) * 1.5;
    let vy = sin(angle) * 1.5;

    stroke(255, 15);
    point(x, y);
    x += vx;
    y += vy;

    if (x < 0 || x > width || y < 0 || y > height) break;
  }
}

// Interactive controls
function keyPressed() {
  if (key === 'r') { seed = floor(random(9999)); redraw(); }
  if (key === 's') { saveCanvas('art', 'png'); }
}
</script>
</body>
</html>
\`\`\`

## Common Techniques

### Particle Systems
\`\`\`javascript
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D();
    this.life = 255;
  }

  update() {
    this.pos.add(this.vel);
    this.life -= 2;
  }

  draw() {
    stroke(255, this.life);
    point(this.pos.x, this.pos.y);
  }
}
\`\`\`

### Perlin Noise Field
\`\`\`javascript
for (let y = 0; y < height; y += 5) {
  for (let x = 0; x < width; x += 5) {
    let angle = noise(x * 0.01, y * 0.01, frameCount * 0.005) * TWO_PI;
    stroke(hue(angle), 80, 80, 0.5);
    strokeWeight(1.5);
    push();
    translate(x, y);
    rotate(angle);
    line(0, 0, 5, 0);
    pop();
  }
}
\`\`\`

Source: https://github.com/anthropics/skills/tree/main/skills/algorithmic-art`,
  },

  {
    title: 'Canvas Design (PDF/PNG)',
    description: 'Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art, design, or other static piece. Create original visual designs, never copying existing artists\' work to avoid copyright violations.',
    tags: 'anthropic,design,poster,art,canvas,pdf,png,python,pillow,reportlab',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/canvas-design',
    skill_name: 'canvas-design',
    category: 'creative',
    script_content: `---
name: canvas-design
description: Create beautiful visual art in .png and .pdf documents using design philosophy. Use when the user asks to create a poster, piece of art, design, or other static piece.
license: Proprietary. LICENSE.txt has complete terms
---

# Canvas Design

Create design philosophies as aesthetic movements, then EXPRESS them visually. Output .md files, .pdf files, and .png files.

## Two-Step Process

### Step 1: Design Philosophy

Write a philosophy document before generating the visual:

\`\`\`markdown
# Brutalist Grid System

Industrial severity meets careful information architecture.
Structure is visible, not hidden. Grids are features, not scaffolding.

## Visual Language
- Heavy borders signal boundaries
- Stark monochrome with single accent
- Typography as structural element
\`\`\`

### Step 2: Express Visually (Python)

\`\`\`python
from PIL import Image, ImageDraw, ImageFont
import os

# Canvas setup
WIDTH, HEIGHT = 2400, 3200  # High-res poster
canvas = Image.new('RGB', (WIDTH, HEIGHT), '#0D0D0D')
draw = ImageDraw.Draw(canvas)

# Typography
try:
    title_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 180)
    body_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 72)
except:
    title_font = ImageFont.load_default()
    body_font = ImageFont.load_default()

# Layout
MARGIN = 160
accent = '#E85D04'

# Title
draw.text((MARGIN, MARGIN), "POSTER TITLE", fill='#F5F0E8', font=title_font)

# Accent line
draw.rectangle([MARGIN, MARGIN + 220, MARGIN + 800, MARGIN + 232], fill=accent)

# Body text
draw.text((MARGIN, MARGIN + 280), "Subtitle or body copy", fill='#999999', font=body_font)

# Grid overlay
for i in range(0, WIDTH, 200):
    draw.line([(i, 0), (i, HEIGHT)], fill='#1A1A1A', width=1)

# Save
canvas.save('poster.png', 'PNG', dpi=(300, 300))
print("Saved poster.png")
\`\`\`

## PDF Output

\`\`\`python
from reportlab.lib.pagesizes import A4, letter
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.colors import HexColor

c = pdfcanvas.Canvas("poster.pdf", pagesize=A4)
width, height = A4  # 595 x 842 points

# Background
c.setFillColor(HexColor('#0D0D0D'))
c.rect(0, 0, width, height, fill=True)

# Text
c.setFillColor(HexColor('#F5F0E8'))
c.setFont("Helvetica-Bold", 48)
c.drawString(40, height - 100, "Title")

c.save()
\`\`\`

## Design Principles

- **Hierarchy**: One dominant element per composition
- **Tension**: Asymmetry creates visual interest
- **Restraint**: Less elements, more impact
- **Color**: 2-3 colors max. One dominant, one supporting, one accent

Source: https://github.com/anthropics/skills/tree/main/skills/canvas-design`,
  },

  {
    title: 'Document Co-Authoring',
    description: 'Guide users through a structured workflow for co-authoring documentation. Use when user wants to write documentation, proposals, technical specs, decision docs, or similar structured content. This workflow helps users efficiently transfer context, refine content through iteration, and verify the doc works for readers.',
    tags: 'anthropic,documentation,writing,co-authoring,proposals,specs,technical-writing',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/doc-coauthoring',
    skill_name: 'doc-coauthoring',
    category: 'productivity',
    script_content: `---
name: doc-coauthoring
description: Guide users through a structured workflow for co-authoring documentation. Use when user wants to write documentation, proposals, technical specs, decision docs, or similar structured content.
license: Proprietary. LICENSE.txt has complete terms
---

# Doc Co-Authoring Workflow

A structured workflow for guiding users through collaborative document creation. Act as an active guide walking users through three stages.

## Stage 1: Context Gathering

Ask targeted questions to understand:

\`\`\`
1. What is the primary purpose of this document?
   (inform, persuade, instruct, decide, propose)

2. Who is the primary reader?
   (technical, executive, customer, team member)

3. What should the reader DO or KNOW after reading?
   (one specific, measurable outcome)

4. What context does the reader already have?
   (avoid over-explaining what they know)

5. What's the key constraint?
   (length, tone, deadline, sensitivity)
\`\`\`

## Stage 2: Refinement and Structure

### Document Templates

**Technical Spec**
\`\`\`markdown
# [Feature Name] — Technical Specification

## Summary
One paragraph. What, why, and scope.

## Background
Problem being solved. Why now.

## Design
Detailed technical approach. Diagrams if helpful.

## Alternatives Considered
What you evaluated and why you chose this approach.

## Implementation Plan
Phases, owners, and timeline.

## Open Questions
What still needs resolution.
\`\`\`

**Decision Document**
\`\`\`markdown
# Decision: [What are we deciding?]

## Context
Why this decision matters now.

## Options Considered
| Option | Pros | Cons | Effort |
|--------|------|------|--------|
| A | ... | ... | Low |
| B | ... | ... | High |

## Recommendation
Option X because [core reason].

## Next Steps
Who does what by when.
\`\`\`

**Proposal**
\`\`\`markdown
# Proposal: [What You're Proposing]

## Problem
What's broken or missing. Evidence.

## Proposed Solution
Specific, concrete description.

## Expected Outcomes
Measurable benefits.

## Resources Required
Time, people, money, tools.

## Risks
What could go wrong. Mitigations.
\`\`\`

## Stage 3: Reader Testing

Before finalizing, test the document:

\`\`\`
[ ] Can you state the main point in one sentence?
[ ] Is every section necessary?
[ ] Are all acronyms defined on first use?
[ ] Does the opening paragraph answer: what, who, why care?
[ ] Is the ask/recommendation clear?
[ ] Would the primary reader understand without asking questions?
\`\`\`

## Iteration Principles

- **Start with structure, then fill content** — don't write linearly
- **Kill your darlings** — remove sections that don't serve the reader
- **Active voice** — "We decided X" not "It was decided that X"
- **Concrete over abstract** — "Reduces latency by 40ms" not "improves performance"

Source: https://github.com/anthropics/skills/tree/main/skills/doc-coauthoring`,
  },

  {
    title: 'Skill Creator',
    description: 'Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill\'s description for better triggering accuracy.',
    tags: 'anthropic,skill-creator,meta-skill,evals,optimization,description-engineering',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/skill-creator',
    skill_name: 'skill-creator',
    category: 'development',
    script_content: `---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, or optimize a skill's description for better triggering accuracy.
license: Proprietary. LICENSE.txt has complete terms
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

## Creating a New Skill

### SKILL.md Structure

\`\`\`markdown
---
name: my-skill
description: [Critical: This controls when the skill triggers. Be specific about WHEN to use and when NOT to use.]
license: [MIT | Apache-2.0 | Proprietary]
---

# Skill Name

[Main instructions for Claude when this skill is active]

## When to Use
- Specific trigger conditions
- Examples of requests that should activate this skill

## When NOT to Use
- Anti-triggers — requests that look similar but shouldn't activate
- Out-of-scope scenarios

## Core Approach
[Step-by-step methodology]

## Examples
[Concrete examples with expected outputs]
\`\`\`

## Description Engineering

The description field is the most critical part — it's used for routing decisions.

### Good Description Pattern:
\`\`\`
[Action verb] [specific task]. TRIGGER when: [list of concrete trigger conditions].
DO NOT TRIGGER when: [list of anti-trigger conditions].
\`\`\`

### Example:
\`\`\`
Process PDF files. TRIGGER when: user mentions .pdf file, asks to extract text from PDF,
wants to merge/split PDFs, or asks to create a PDF. DO NOT TRIGGER when: user wants
a Word doc, HTML page, or asks about PDFs conceptually without a file.
\`\`\`

## Evaluating Skills

### Creating Evals

\`\`\`python
evals = [
    # Positive triggers (should activate)
    {"input": "Read the PDF and summarize it", "expected": "trigger"},
    {"input": "Merge these 3 PDF files", "expected": "trigger"},

    # Negative triggers (should NOT activate)
    {"input": "Create a Word document", "expected": "no_trigger"},
    {"input": "What is a PDF?", "expected": "no_trigger"},
]
\`\`\`

### Running Evals

\`\`\`python
import anthropic

client = anthropic.Anthropic()
correct = 0

for eval_case in evals:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        system=f"You have access to this skill: {skill_description}",
        messages=[{"role": "user", "content": eval_case["input"]}],
        tools=[skill_routing_tool]
    )
    predicted = extract_routing_decision(response)
    if predicted == eval_case["expected"]:
        correct += 1

accuracy = correct / len(evals)
print(f"Accuracy: {accuracy:.1%}")
\`\`\`

## Iterating on Skills

1. **Baseline**: Run evals on current skill, note accuracy
2. **Identify failures**: Cluster false positives and false negatives
3. **Hypothesize**: What's ambiguous in the description?
4. **Edit**: Clarify trigger conditions
5. **Re-eval**: Measure improvement
6. **Repeat**: Until accuracy plateaus

Source: https://github.com/anthropics/skills/tree/main/skills/skill-creator`,
  },

  {
    title: 'Theme Factory',
    description: 'Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reports, HTML landing pages, etc. There are 10 pre-set themes with colors/fonts that you can apply to any artifact that has been created, or can generate a new theme on-the-fly.',
    tags: 'anthropic,themes,styling,colors,fonts,design-system,artifacts',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/theme-factory',
    skill_name: 'theme-factory',
    category: 'design',
    script_content: `---
name: theme-factory
description: Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reports, HTML landing pages, etc. There are 10 pre-set themes with colors/fonts that you can apply to any artifact, or generate a new theme on-the-fly.
license: Proprietary. LICENSE.txt has complete terms
---

# Theme Factory Skill

This skill provides a curated collection of professional font and color themes, each with carefully selected color palettes and font pairings.

## Pre-Set Themes

### 1. Ocean Depths
\`\`\`
Primary: #0D3B66    (deep navy)
Secondary: #1B6CA8  (ocean blue)
Accent: #00B4D8     (cyan)
Background: #F0F8FF (alice blue)
Text: #1A1A2E
Fonts: Montserrat (headers) + Open Sans (body)
\`\`\`

### 2. Sunset Boulevard
\`\`\`
Primary: #FF6B35    (warm orange)
Secondary: #F7C59F  (peach)
Accent: #EFEFD0     (cream)
Background: #1A1A2E (dark navy)
Text: #EFEFD0
Fonts: Raleway (headers) + Lato (body)
\`\`\`

### 3. Forest Canopy
\`\`\`
Primary: #2D6A4F    (forest green)
Secondary: #74C69D  (mint)
Accent: #D8F3DC     (light mint)
Background: #F8F9FA (off white)
Text: #1B2E1E
Fonts: Merriweather (headers) + Source Sans Pro (body)
\`\`\`

### 4. Midnight Executive
\`\`\`
Primary: #1E2761    (deep navy)
Secondary: #7A2048  (burgundy)
Accent: #CADCFC     (ice blue)
Background: #0A0A0A (near black)
Text: #F5F5F5
Fonts: Playfair Display (headers) + Inter (body)
\`\`\`

### 5. Cherry Blossom
\`\`\`
Primary: #C9184A    (cherry)
Secondary: #FF758F  (pink)
Accent: #FFB3C1     (light pink)
Background: #FFF0F3 (blush white)
Text: #2D0A12
Fonts: Cormorant Garamond (headers) + Nunito (body)
\`\`\`

### 6. Golden Hour
\`\`\`
Primary: #E9C46A    (gold)
Secondary: #F4A261  (warm orange)
Accent: #264653    (dark teal)
Background: #FDFCF0 (warm white)
Text: #1A0A00
Fonts: Josefin Sans (headers) + Karla (body)
\`\`\`

### 7. Arctic Minimal
\`\`\`
Primary: #E8F4F8    (ice)
Secondary: #A8D5E2  (light blue)
Accent: #0077B6     (vivid blue)
Background: #FFFFFF (white)
Text: #0D1117
Fonts: Space Grotesk (headers) + Inter (body)
\`\`\`

### 8. Terracotta Earth
\`\`\`
Primary: #B85042    (terracotta)
Secondary: #E7E8D1  (sand)
Accent: #A7BEAE     (sage)
Background: #FAF7F2 (warm cream)
Text: #2C1810
Fonts: Abril Fatface (headers) + Libre Baskerville (body)
\`\`\`

### 9. Neon Noir
\`\`\`
Primary: #0F0F0F    (near black)
Secondary: #1A1A2E  (dark navy)
Accent: #00FF88     (neon green)
Background: #050505 (black)
Text: #E0E0E0
Fonts: Exo 2 (headers) + Roboto Mono (body)
\`\`\`

### 10. Lavender Fields
\`\`\`
Primary: #7B5EA7    (purple)
Secondary: #9B89C4  (lavender)
Accent: #F3E8FF     (light purple)
Background: #FDFCFF (near white)
Text: #2D1B69
Fonts: Cinzel (headers) + Crimson Text (body)
\`\`\`

## Applying Themes

### HTML/CSS
\`\`\`css
:root {
  --primary: #0D3B66;
  --secondary: #1B6CA8;
  --accent: #00B4D8;
  --bg: #F0F8FF;
  --text: #1A1A2E;
}
\`\`\`

### Tailwind Config
\`\`\`js
theme: {
  extend: {
    colors: {
      primary: '#0D3B66',
      secondary: '#1B6CA8',
      accent: '#00B4D8',
    }
  }
}
\`\`\`

Source: https://github.com/anthropics/skills/tree/main/skills/theme-factory`,
  },

  {
    title: 'Slack GIF Creator',
    description: 'Knowledge and utilities for creating animated GIFs optimized for Slack. Provides constraints, validation tools, and animation concepts. Use when users request animated GIFs for Slack like "make me a GIF of X doing Y for Slack."',
    tags: 'anthropic,slack,gif,animation,pillow,emoji,messaging',
    repo_url: 'https://github.com/anthropics/skills/tree/main/skills/slack-gif-creator',
    skill_name: 'slack-gif-creator',
    category: 'creative',
    script_content: `---
name: slack-gif-creator
description: Knowledge and utilities for creating animated GIFs optimized for Slack. Provides constraints, validation tools, and animation concepts. Use when users request animated GIFs for Slack.
license: Proprietary. LICENSE.txt has complete terms
---

# Slack GIF Creator

A toolkit for creating animated GIFs optimized for Slack.

## Slack Requirements

**Dimensions:**
- Emoji GIFs: 128x128 px (recommended)
- Message GIFs: max 1920x1080 px
- Inline GIFs: 500x500 px (common sweet spot)

**File Size:**
- Emoji: under 128KB
- Message GIFs: under 2MB (Slack limit)

**Frame Rate:** 10-15 fps recommended for smooth animation

## Creating GIFs with Pillow

\`\`\`python
from PIL import Image, ImageDraw, ImageFont
import math

def create_bouncing_ball_gif(output_path="bounce.gif"):
    frames = []
    width, height = 200, 200

    for i in range(20):
        img = Image.new('RGB', (width, height), '#1A1A2E')
        draw = ImageDraw.Draw(img)

        # Bouncing animation
        t = i / 20  # 0 to 1
        y = height//2 + int(math.sin(t * math.pi * 2) * 60)

        # Ball with glow effect
        for r in range(20, 0, -1):
            alpha = int(255 * (r / 20) * 0.3)
            draw.ellipse([
                width//2 - r, y - r,
                width//2 + r, y + r
            ], fill=(0, 255, 136, alpha))

        draw.ellipse([
            width//2 - 12, y - 12,
            width//2 + 12, y + 12
        ], fill='#00FF88')

        frames.append(img)

    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        loop=0,
        duration=80,  # ms per frame = ~12fps
        optimize=True
    )

create_bouncing_ball_gif()
\`\`\`

## Text Animation GIF

\`\`\`python
from PIL import Image, ImageDraw, ImageFont

def create_typing_gif(text, output_path="typing.gif"):
    frames = []

    for i in range(len(text) + 5):
        img = Image.new('RGB', (300, 80), '#0D0D0D')
        draw = ImageDraw.Draw(img)

        display = text[:i] + ('|' if i % 2 == 0 else ' ')
        draw.text((10, 20), display, fill='#00FF88')

        frames.append(img)

    frames[0].save(output_path, save_all=True, append_images=frames[1:],
                   loop=0, duration=100, optimize=True)

create_typing_gif("Hello Slack! 👋")
\`\`\`

## Optimization

\`\`\`python
from PIL import Image

def optimize_for_slack(input_path, output_path, max_size_kb=128):
    img = Image.open(input_path)

    # Resize for emoji if needed
    if max(img.size) > 128:
        img = img.resize((128, 128), Image.LANCZOS)

    # Save with optimization
    img.save(output_path, 'GIF', optimize=True, colors=64)

    import os
    size_kb = os.path.getsize(output_path) / 1024
    print(f"Size: {size_kb:.1f}KB {'✓' if size_kb <= max_size_kb else '✗ too large'}")

optimize_for_slack('animation.gif', 'slack_emoji.gif')
\`\`\`

## Animation Concepts

- **Easing**: Use sine/cosine for natural motion, not linear
- **Loop**: Ensure first and last frames connect smoothly
- **Colors**: Reduce palette to 64-128 colors for smaller files
- **Dithering**: Avoid dithering for crisp edges on small GIFs

Source: https://github.com/anthropics/skills/tree/main/skills/slack-gif-creator`,
  },

];

// ---------------------------------------------------------------------------
// OPENAI SKILLS (curated — OpenAI's official skill repos are not public)
// ---------------------------------------------------------------------------

const OPENAI_SKILLS = [

  {
    title: 'OpenAI Codex CLI Agent',
    description: 'Autonomous coding agent powered by OpenAI Codex. Executes shell commands, writes and edits files, runs tests, and performs multi-step coding tasks. The agent can work in your codebase with sandboxed execution and approval flows.',
    tags: 'openai,codex,agent,cli,coding,automation,shell',
    repo_url: 'https://github.com/openai/codex',
    skill_name: 'codex-agent',
    category: 'ai',
    script_content: `---
name: codex-agent
description: Autonomous coding agent powered by OpenAI Codex. Executes shell commands, writes and edits files, runs tests, and performs multi-step coding tasks.
source: https://github.com/openai/codex
---

# OpenAI Codex CLI Agent

## Overview

Codex is an autonomous coding agent that can execute shell commands, write and edit files, run tests, and perform multi-step coding tasks with approval flows.

## Installation

\`\`\`bash
npm install -g @openai/codex
\`\`\`

## Basic Usage

\`\`\`bash
# Interactive mode
codex

# Single task
codex "Add error handling to src/api.js"

# With approval (safe mode)
codex --approval-policy on-failure "Run the test suite and fix failures"
\`\`\`

## Approval Policies

- \`suggest\`: Show changes before applying (safest)
- \`on-failure\`: Auto-apply if tests pass, ask on failure
- \`auto-edit\`: Apply file changes automatically
- \`full-auto\`: Fully autonomous (use carefully)

## Environment Variables

\`\`\`bash
export OPENAI_API_KEY="sk-..."
export CODEX_MODEL="o4-mini"  # or gpt-4.1, o3
\`\`\`

## Configuration (.codex/config.json)

\`\`\`json
{
  "model": "o4-mini",
  "approvalPolicy": "on-failure",
  "sandbox": true,
  "notify": true
}
\`\`\`

## Use Cases

- Autonomous bug fixing with test verification
- Multi-file refactoring tasks
- Code generation from natural language specs
- Running and fixing failing CI/CD pipelines
- Code review and suggested improvements`,
  },

  {
    title: 'OpenAI Responses API',
    description: 'Build stateful, multi-turn AI agents with built-in tools using the OpenAI Responses API. Includes web search, file search, code interpreter, and computer use. Designed for agentic workflows with streaming and background execution.',
    tags: 'openai,responses-api,agents,tools,web-search,code-interpreter,stateful',
    repo_url: 'https://platform.openai.com/docs/api-reference/responses',
    skill_name: 'openai-responses',
    category: 'ai',
    script_content: `---
name: openai-responses
description: Build stateful, multi-turn AI agents using the OpenAI Responses API with built-in tools (web search, file search, code interpreter, computer use).
source: https://platform.openai.com/docs/api-reference/responses
---

# OpenAI Responses API

## Overview

The Responses API is OpenAI's newest API surface for building agentic AI. It supports stateful conversations, built-in tools, streaming, and background execution.

## Basic Usage

\`\`\`python
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-4.1",
    input="What is the weather in Tokyo today?",
    tools=[{"type": "web_search_preview"}]
)

print(response.output_text)
\`\`\`

## Multi-Turn Conversations

\`\`\`python
# First turn
response = client.responses.create(
    model="gpt-4.1",
    input="Research the latest AI news",
    tools=[{"type": "web_search_preview"}]
)

# Continue with previous response as context
response2 = client.responses.create(
    model="gpt-4.1",
    previous_response_id=response.id,
    input="Now summarize the top 3 trends you found"
)
\`\`\`

## Built-in Tools

\`\`\`python
tools = [
    {"type": "web_search_preview"},          # Real-time web search
    {"type": "file_search", "vector_store_ids": ["vs_abc"]},  # RAG
    {"type": "code_interpreter",             # Python execution
     "container": {"type": "auto"}},
    {"type": "computer_use_preview",         # Browser/desktop control
     "environment": "browser"}
]
\`\`\`

## Streaming

\`\`\`python
with client.responses.stream(
    model="gpt-4.1",
    input="Explain quantum computing",
) as stream:
    for event in stream:
        if event.type == "response.output_text.delta":
            print(event.delta, end="", flush=True)
\`\`\`

## Function Calling

\`\`\`python
tools = [{
    "type": "function",
    "name": "get_weather",
    "description": "Get current weather",
    "parameters": {
        "type": "object",
        "properties": {
            "city": {"type": "string"}
        }
    }
}]
\`\`\``,
  },

  {
    title: 'OpenAI Agents SDK',
    description: 'Build production-grade multi-agent systems using the OpenAI Agents SDK. Features agent handoffs, guardrails, tracing, and orchestration patterns. Works with any LLM via LiteLLM integration.',
    tags: 'openai,agents-sdk,multi-agent,handoffs,orchestration,guardrails,tracing',
    repo_url: 'https://github.com/openai/openai-agents-python',
    skill_name: 'openai-agents',
    category: 'ai',
    script_content: `---
name: openai-agents
description: Build production-grade multi-agent systems using the OpenAI Agents SDK. Features agent handoffs, guardrails, tracing, and orchestration patterns.
source: https://github.com/openai/openai-agents-python
---

# OpenAI Agents SDK

## Installation

\`\`\`bash
pip install openai-agents
\`\`\`

## Basic Agent

\`\`\`python
from agents import Agent, Runner

agent = Agent(
    name="Assistant",
    instructions="You are a helpful assistant",
    model="gpt-4.1"
)

result = Runner.run_sync(agent, "What is 2+2?")
print(result.final_output)
\`\`\`

## Tools

\`\`\`python
from agents import Agent, function_tool

@function_tool
def search_web(query: str) -> str:
    """Search the web for information"""
    # Implementation
    return results

@function_tool
def read_file(path: str) -> str:
    """Read a file from disk"""
    with open(path) as f:
        return f.read()

agent = Agent(
    name="Research Agent",
    tools=[search_web, read_file],
    model="gpt-4.1"
)
\`\`\`

## Multi-Agent Handoffs

\`\`\`python
from agents import Agent, handoff

coding_agent = Agent(
    name="Coding Agent",
    instructions="Expert at writing code"
)

research_agent = Agent(
    name="Research Agent",
    instructions="Expert at finding information",
    handoffs=[handoff(coding_agent, "When user needs code written")]
)

triage_agent = Agent(
    name="Triage",
    instructions="Route requests to the right specialist",
    handoffs=[research_agent, coding_agent]
)
\`\`\`

## Guardrails

\`\`\`python
from agents import Agent, input_guardrail, GuardrailFunctionOutput

@input_guardrail
async def safety_check(ctx, agent, input):
    # Check for harmful content
    is_safe = await check_content(input)
    return GuardrailFunctionOutput(
        output_info={"safe": is_safe},
        tripwire_triggered=not is_safe
    )

agent = Agent(
    name="Safe Agent",
    input_guardrails=[safety_check]
)
\`\`\`

## Streaming

\`\`\`python
async def stream_response():
    async with Runner.run_streamed(agent, "Tell me a story") as stream:
        async for event in stream.stream_events():
            if event.type == "raw_response_event":
                print(event.data.delta, end="")
\`\`\``,
  },

  {
    title: 'DALL-E 3 Image Generation',
    description: 'Generate, edit, and vary images with OpenAI\'s DALL-E 3. Create photorealistic images, illustrations, and art from text prompts with precise instruction following. Supports inpainting, outpainting, and style transfer.',
    tags: 'openai,dall-e,image-generation,creative,art,inpainting,gpt4v',
    repo_url: 'https://platform.openai.com/docs/guides/images',
    skill_name: 'dalle-image-gen',
    category: 'creative',
    script_content: `---
name: dalle-image-gen
description: Generate, edit, and vary images with OpenAI's DALL-E 3. Create photorealistic images, illustrations, and art from text prompts with precise instruction following.
source: https://platform.openai.com/docs/guides/images
---

# DALL-E 3 Image Generation

## Generate Images

\`\`\`python
from openai import OpenAI
import requests

client = OpenAI()

response = client.images.generate(
    model="dall-e-3",
    prompt="A serene Japanese zen garden at golden hour, photorealistic",
    size="1792x1024",  # landscape
    quality="hd",
    n=1
)

# Download and save
image_url = response.data[0].url
img_data = requests.get(image_url).content
with open("garden.png", "wb") as f:
    f.write(img_data)

# Revised prompt (DALL-E may enhance your prompt)
print(response.data[0].revised_prompt)
\`\`\`

## Sizes Available

- \`1024x1024\` — Square
- \`1792x1024\` — Landscape (16:9)
- \`1024x1792\` — Portrait (9:16)

## Quality Options

- \`standard\` — Faster, cheaper
- \`hd\` — Higher detail, better coherence

## Edit Images (Inpainting)

\`\`\`python
response = client.images.edit(
    model="dall-e-2",  # Only DALL-E 2 supports edits
    image=open("original.png", "rb"),
    mask=open("mask.png", "rb"),  # Black = edit area, White = keep
    prompt="A fluffy cat sitting in the empty chair",
    size="1024x1024",
    n=1
)
\`\`\`

## Create Variations

\`\`\`python
response = client.images.create_variation(
    model="dall-e-2",
    image=open("original.png", "rb"),
    n=3,
    size="1024x1024"
)

for i, img in enumerate(response.data):
    print(f"Variation {i+1}: {img.url}")
\`\`\`

## Prompt Engineering Tips

- **Be specific**: "A photorealistic oil painting of..." not "a painting of..."
- **Describe lighting**: "golden hour", "studio lighting", "overcast natural light"
- **Specify style**: "in the style of Art Nouveau", "minimalist line art", "8K cinematic"
- **Composition**: "close-up portrait", "wide establishing shot", "bird's-eye view"
- **Colors**: "muted earth tones", "vibrant neon palette", "monochromatic blue"`,
  },

  {
    title: 'Whisper Speech-to-Text',
    description: 'Transcribe and translate audio in 57 languages using OpenAI Whisper. Features word-level timestamps, speaker diarization, automatic punctuation, and real-time streaming transcription.',
    tags: 'openai,whisper,speech-to-text,transcription,translation,audio,multilingual',
    repo_url: 'https://platform.openai.com/docs/guides/speech-to-text',
    skill_name: 'whisper-transcription',
    category: 'ai',
    script_content: `---
name: whisper-transcription
description: Transcribe and translate audio in 57 languages using OpenAI Whisper. Features word-level timestamps, speaker diarization, and real-time streaming.
source: https://platform.openai.com/docs/guides/speech-to-text
---

# Whisper Speech-to-Text

## Basic Transcription

\`\`\`python
from openai import OpenAI

client = OpenAI()

with open("audio.mp3", "rb") as audio_file:
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        language="en"  # Optional: specify language for better accuracy
    )

print(transcript.text)
\`\`\`

## Translation to English

\`\`\`python
with open("french_audio.mp3", "rb") as audio_file:
    translation = client.audio.translations.create(
        model="whisper-1",
        file=audio_file
    )

print(translation.text)  # Always in English
\`\`\`

## With Timestamps

\`\`\`python
transcript = client.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file,
    response_format="verbose_json",
    timestamp_granularities=["word", "segment"]
)

# Word-level timestamps
for word in transcript.words:
    print(f"{word.start:.2f}s - {word.end:.2f}s: {word.word}")

# Segment-level
for segment in transcript.segments:
    print(f"[{segment.start:.1f}s] {segment.text}")
\`\`\`

## Supported Formats

- MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM
- Max file size: 25MB
- Tip: For longer files, split into chunks:

\`\`\`python
from pydub import AudioSegment

def transcribe_long_audio(path, chunk_ms=10*60*1000):
    audio = AudioSegment.from_mp3(path)
    chunks = [audio[i:i+chunk_ms] for i in range(0, len(audio), chunk_ms)]

    full_transcript = ""
    for i, chunk in enumerate(chunks):
        chunk.export(f"chunk_{i}.mp3", format="mp3")
        with open(f"chunk_{i}.mp3", "rb") as f:
            result = client.audio.transcriptions.create(model="whisper-1", file=f)
        full_transcript += result.text + " "

    return full_transcript
\`\`\`

## Prompt for Better Accuracy

\`\`\`python
transcript = client.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file,
    prompt="Technical interview about React hooks and TypeScript"  # Context helps
)
\`\`\`

## Supported Languages (57+)

English, Spanish, French, German, Japanese, Chinese, Korean, Portuguese, Italian, Russian, Arabic, Hindi, and 45 more.`,
  },

];

// ---------------------------------------------------------------------------
// GOOGLE AI SKILLS
// ---------------------------------------------------------------------------

const GOOGLE_SKILLS = [

  {
    title: 'Google Gemini API',
    description: 'Access Google\'s Gemini models (Gemini 2.0 Flash, Gemini 1.5 Pro) for text, vision, audio, and code. Features a 2M token context window, multimodal inputs, function calling, code execution, and streaming.',
    tags: 'google,gemini,llm,multimodal,vision,2m-context,function-calling',
    repo_url: 'https://ai.google.dev/api',
    skill_name: 'gemini-api',
    category: 'ai',
    script_content: `---
name: gemini-api
description: Access Google's Gemini models for text, vision, audio, and code. Features 2M token context, multimodal inputs, function calling, and code execution.
source: https://ai.google.dev/api
---

# Google Gemini API

## Installation

\`\`\`bash
pip install google-generativeai
\`\`\`

## Basic Text Generation

\`\`\`python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")

model = genai.GenerativeModel("gemini-2.0-flash")
response = model.generate_content("Explain quantum entanglement simply")
print(response.text)
\`\`\`

## Vision (Image + Text)

\`\`\`python
import PIL.Image

model = genai.GenerativeModel("gemini-1.5-pro")
image = PIL.Image.open("diagram.png")

response = model.generate_content([
    image,
    "Describe what's shown in this diagram and explain the key concepts"
])
print(response.text)
\`\`\`

## Multi-turn Chat

\`\`\`python
model = genai.GenerativeModel("gemini-2.0-flash")
chat = model.start_chat()

response = chat.send_message("What is machine learning?")
print(response.text)

response = chat.send_message("Give me a simple Python example")
print(response.text)
\`\`\`

## Function Calling

\`\`\`python
def get_weather(location: str) -> dict:
    return {"temperature": 22, "condition": "sunny", "location": location}

model = genai.GenerativeModel(
    "gemini-2.0-flash",
    tools=[get_weather]  # Gemini auto-generates the schema
)

response = model.generate_content("What's the weather in Tokyo?")
# Gemini calls get_weather("Tokyo") automatically
\`\`\`

## Code Execution

\`\`\`python
model = genai.GenerativeModel(
    "gemini-2.0-flash",
    tools="code_execution"
)

response = model.generate_content(
    "Calculate the first 20 Fibonacci numbers and plot them"
)
\`\`\`

## Streaming

\`\`\`python
for chunk in model.generate_content("Write a poem", stream=True):
    print(chunk.text, end="", flush=True)
\`\`\`

## Large Context (1M tokens)

\`\`\`python
model = genai.GenerativeModel("gemini-1.5-pro")

# Can handle entire codebases, books, or long documents
with open("entire_codebase.txt") as f:
    code = f.read()

response = model.generate_content(f"Analyze this codebase:\\n{code}")
\`\`\``,
  },

];

// ---------------------------------------------------------------------------
// MICROSOFT SKILLS
// ---------------------------------------------------------------------------

const MICROSOFT_SKILLS = [

  {
    title: 'Azure AI Foundry (Phi-4)',
    description: 'Access Microsoft\'s Phi-4 small language models (SLMs) — state-of-the-art 14B parameter models that outperform much larger models on reasoning and coding benchmarks. Run locally or via Azure AI Foundry.',
    tags: 'microsoft,phi-4,slm,azure,ai-foundry,reasoning,coding,local-llm',
    repo_url: 'https://azure.microsoft.com/en-us/products/phi/',
    skill_name: 'phi4-model',
    category: 'ai',
    script_content: `---
name: phi4-model
description: Access Microsoft Phi-4 small language models — 14B parameter models that outperform much larger models on reasoning and coding. Run locally or via Azure AI Foundry.
source: https://azure.microsoft.com/products/phi/
---

# Microsoft Phi-4 Models

## Overview

Phi-4 is Microsoft's most capable SLM (Small Language Model) — 14B parameters but outperforms 70B+ models on many benchmarks.

## Models

| Model | Parameters | Best For |
|-------|-----------|----------|
| phi-4 | 14B | Reasoning, coding, math |
| phi-4-mini | 3.8B | On-device, edge deployment |
| phi-4-multimodal | 5.6B | Vision + text tasks |

## Via Azure AI Inference

\`\`\`python
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import SystemMessage, UserMessage
from azure.core.credentials import AzureKeyCredential

client = ChatCompletionsClient(
    endpoint="https://models.inference.ai.azure.com",
    credential=AzureKeyCredential(os.environ["GITHUB_TOKEN"])
)

response = client.complete(
    messages=[
        SystemMessage("You are a helpful assistant."),
        UserMessage("Explain recursion with a Python example")
    ],
    model="Phi-4",
    temperature=0.1,
    max_tokens=1024
)

print(response.choices[0].message.content)
\`\`\`

## Run Locally with Ollama

\`\`\`bash
# Pull Phi-4
ollama pull phi4

# Run interactively
ollama run phi4

# API server
ollama serve
\`\`\`

\`\`\`python
import ollama

response = ollama.chat(
    model='phi4',
    messages=[{'role': 'user', 'content': 'Write a binary search in Python'}]
)
print(response['message']['content'])
\`\`\`

## Via Hugging Face

\`\`\`python
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

model_name = "microsoft/phi-4"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.bfloat16,
    device_map="auto"
)

inputs = tokenizer("def fibonacci(n):", return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=200)
print(tokenizer.decode(outputs[0]))
\`\`\`

## Benchmarks vs Other Models

- **GPQA Diamond**: Phi-4 (56.1%) vs GPT-4o (53.6%)
- **HumanEval**: Phi-4 (82.6%) — top coding model in its class
- **MATH**: Phi-4 (80.4%) — exceptional math reasoning`,
  },

  {
    title: 'Semantic Kernel (AI Orchestration)',
    description: 'Microsoft\'s open-source SDK for building AI agents and plugins with LLMs. Orchestrate OpenAI, Azure OpenAI, Hugging Face, and other models with a unified plugin architecture, memory, and planning capabilities.',
    tags: 'microsoft,semantic-kernel,orchestration,plugins,memory,planning,dotnet,python',
    repo_url: 'https://github.com/microsoft/semantic-kernel',
    skill_name: 'semantic-kernel',
    category: 'ai',
    script_content: `---
name: semantic-kernel
description: Microsoft's open-source SDK for building AI agents and plugins with LLMs. Orchestrate multiple AI models with a unified plugin architecture, memory, and planning.
source: https://github.com/microsoft/semantic-kernel
---

# Semantic Kernel

## Installation

\`\`\`bash
pip install semantic-kernel
\`\`\`

## Basic Setup

\`\`\`python
import asyncio
import semantic_kernel as sk
from semantic_kernel.connectors.ai.open_ai import OpenAIChatCompletion

kernel = sk.Kernel()

kernel.add_service(
    OpenAIChatCompletion(
        service_id="openai",
        ai_model_id="gpt-4.1",
        api_key="your-api-key"
    )
)
\`\`\`

## Plugins (Native Functions)

\`\`\`python
from semantic_kernel.functions import kernel_function

class MathPlugin:
    @kernel_function(description="Add two numbers")
    def add(self, a: float, b: float) -> float:
        return a + b

    @kernel_function(description="Multiply two numbers")
    def multiply(self, a: float, b: float) -> float:
        return a * b

kernel.add_plugin(MathPlugin(), "Math")
\`\`\`

## Semantic Functions (Prompt Templates)

\`\`\`python
from semantic_kernel.prompt_template import PromptTemplateConfig

summarize = kernel.add_function(
    function_name="Summarize",
    plugin_name="Utils",
    prompt="Summarize this text in {{$language}}: {{$input}}",
    template_format="semantic-kernel"
)

result = await kernel.invoke(
    summarize,
    input="Long text to summarize...",
    language="English"
)
print(result)
\`\`\`

## Memory (Vector Store)

\`\`\`python
from semantic_kernel.memory import SemanticTextMemory
from semantic_kernel.connectors.memory.chroma import ChromaMemoryStore

memory = SemanticTextMemory(
    storage=ChromaMemoryStore(persist_directory="./memory"),
    embeddings_generator=kernel.get_service("openai")
)

# Save memories
await memory.save_information("docs", id="doc1", text="Important document content")

# Search
results = await memory.search("docs", "find relevant info", limit=5)
for result in results:
    print(f"{result.relevance:.2f}: {result.text}")
\`\`\`

## Agents

\`\`\`python
from semantic_kernel.agents import ChatCompletionAgent

agent = ChatCompletionAgent(
    service_id="openai",
    kernel=kernel,
    name="Assistant",
    instructions="You are a helpful coding assistant with access to Math tools"
)

# Multi-turn conversation
thread = None
async for message in agent.invoke(
    messages="Calculate compound interest for $1000 at 5% for 10 years",
    thread=thread
):
    print(message.content)
\`\`\``,
  },

];

// ---------------------------------------------------------------------------
// SEED
// ---------------------------------------------------------------------------

const allListings = [
  ...ANTHROPIC_SKILLS.map(s => ({ ...s, provider: 'Anthropic', official: 1, owner_id: 'system', type: 'skill', price: 'free' })),
  ...OPENAI_SKILLS.map(s => ({ ...s, provider: 'OpenAI', official: 1, owner_id: 'system', type: 'skill', price: 'free' })),
  ...GOOGLE_SKILLS.map(s => ({ ...s, provider: 'Google', official: 1, owner_id: 'system', type: 'skill', price: 'free' })),
  ...MICROSOFT_SKILLS.map(s => ({ ...s, provider: 'Microsoft', official: 1, owner_id: 'system', type: 'skill', price: 'free' })),
];

console.log('Clearing existing marketplace listings...');
db.prepare('DELETE FROM marketplace_listings').run();
try { db.prepare("DELETE FROM sqlite_sequence WHERE name='marketplace_listings'").run(); } catch (_) {}
console.log(`Cleared. Inserting ${allListings.length} official AI skills...\n`);

const insert = db.prepare(`
  INSERT INTO marketplace_listings
    (owner_id, type, title, description, content, tags, price, status, provider, official, avg_rating, rating_count, install_count, created_at, updated_at)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 0, 0, 0, ?, ?)
`);

const insertAll = db.transaction((items) => {
  for (const item of items) {
    const content = {
      skill_name: item.skill_name,
      version: '1.0.0',
      category: item.category,
      author: item.provider,
      repo_url: item.repo_url,
      description: item.description,
      script_content: item.script_content,
    };

    insert.run(
      item.owner_id,
      item.type,
      item.title,
      item.description,
      JSON.stringify(content),
      item.tags,
      item.price,
      item.provider,
      item.official,
      now,
      now
    );
  }
});

insertAll(allListings);

console.log(`Seeded ${allListings.length} marketplace listings:\n`);
const byProvider = {};
allListings.forEach(l => { byProvider[l.provider] = (byProvider[l.provider] || 0) + 1; });
Object.entries(byProvider).sort().forEach(([p, n]) => console.log(`  ${p}: ${n} skills`));

db.close();
console.log('\nDone.');
