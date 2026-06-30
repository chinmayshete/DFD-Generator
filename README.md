# SleekFlow DFD Generator

Convert textual system requirements and workflows into interactive, high-level Data Flow Diagrams (DFDs) using Python, FastAPI, and Azure OpenAI.

---

## ✨ Features

- **Automated DFD Generation**: Translates step-by-step user requirements into visual DFDs.
- **Tailored DFD Shapes**: Automatically formats database tables/data stores as cylinders (`[(Table)]`) and decision nodes as diamonds (`{Decision}`).
- **Premium Glassmorphic UI**: Designed using Vanilla CSS with ambient animated gradients, dark/light theme switching, and smooth transitions.
- **Interactive Canvas**: Zoom in/out, pan, and reset the canvas view using mouse-dragging and scroll-wheel controls.
- **Live Mermaid Code Editor**: View and modify the underlying Mermaid.js code directly and see updates render in real-time.
- **DFD Component Dictionary**: Extracts diagram elements and organizes them in a detailed reference table showing types (Process, Data Store, Decision, Entity) and roles.
- **One-Click Exports**: Download diagrams as vector graphics (**SVG**) or raster images (**PNG**).

---

## 🛠️ Prerequisites

- **Python 3.8 or higher** must be installed on your system.
- Make sure `pip` is available in your command line environment.

---

## ⚙️ Configuration

The application reads its environment configuration from the **`.env`** file located in the root of the project directory.

The following variables should be present in your `.env` file:
```env
AZURE_OPENAI_ENDPOINT=https://<your-resource-name>.openai.azure.com/openai/deployments/<deployment-name>/chat/completions?api-version=<api-version>
AZURE_OPENAI_API_KEY=<your-api-key>
```
*Note: Your project workspace already contains a configured `.env` file.*

---

## 🚀 How to Execute the Project

### Option A: The Fast Windows Launcher (Recommended)
1. Navigate to the project root folder.
2. Double-click the **`run.bat`** file.
3. This script will automatically check and install the required dependencies (FastAPI, Uvicorn, Httpx, etc.) and launch the server.

### Option B: Manual Command Line Execution
If you prefer to start the server manually via command line/terminal:

1. Open your terminal in the project directory.
2. Install the python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI development server:
   ```bash
   python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

---

## 🖥️ Accessing the App

Once the server has started successfully, open your browser and navigate to:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 📝 Example Requirements Format
Paste workflow steps directly into the input control panel. For example:
```text
1. Start
2. Input: FileUploader detects a new file
3. Data: CCRTracking.dbo.SourceFile table is updated with metadata info of new file
4. Process: CCRTracking.dbo.up_SubmitLoadControl generates loadIDs and performs sanity checks
5. Decision: If data needs transformations:
    Yes: Load into CCRStaging DB
    No: Move to CCRAccount DB
6. End
```
Click **Generate Diagram** and watch the server parse it into a DFD!
