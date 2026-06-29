// Predefined templates mapping
const TEMPLATES = {
    sample: `1. Start
2. Input: FileUploader detects a new file
3. Data: CCRTracking.dbo.SourceFile table is updated with metadata info of the new file - cylindrical shape
4. Process: CCRTracking.dbo.up_SubmitLoadControl is triggered to dynamically generate the loadIDs and perform Sanity checks on the file info.
5. Process: Dynamic variables like memberNumber, PortfolioNumber, member_portid etc are identified.
6. Process: ParamDetails column dynamic values are resolved and stored in dbo.Process table.
7. Process: JCS jobs are triggered that starts the load steps in sequence
8. Decision: If data needs any transformations:
    Yes: Data is first loaded into CCRStaging intermediate DB
    No: data is moved directly to final CCRAccount_[placeholder] DB
9. End`,

    auth: `1. Start
2. Input: User enters username and password in Login Form
3. Data: Security.dbo.Users table is checked to verify user credentials - cylindrical shape
4. Process: AuthenticationService verifies salt and hashes password to check for a match
5. Decision: Are credentials valid?
    Yes: SessionToken is generated and stored in Security.dbo.UserSessions table
    No: Generate login failure alert and display error message
6. Process: Audit logging service records user login attempt in SystemLogs.dbo.AuditTrail table
7. End`,

    checkout: `1. Start
2. Input: Customer clicks "Place Order" button in Shopping Cart
3. Data: Catalog.dbo.Inventory table is read to check stock availability - cylindrical shape
4. Decision: Are all items in stock?
    Yes: Reserve stock quantities in inventory table and proceed to payment
    No: Show "Out of stock" notice to customer and end flow
5. Process: PaymentGateway process request via external Stripe API
6. Decision: Was payment successful?
    Yes: Create order records in Orders.dbo.SalesOrder table and notify Warehouse
    No: Release reserved stock and show payment failure alert to customer
7. End`
};

// Application State
let appState = {
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    currentMermaidCode: "",
    components: []
};

// DOM Elements
const elements = {
    html: document.documentElement,
    requirementsInput: document.getElementById('requirements-input'),
    btnGenerate: document.getElementById('btn-generate'),
    btnText: document.querySelector('.btn-text'),
    loader: document.querySelector('.loader'),
    flowDirection: document.getElementById('flow-direction'),
    mermaidCode: document.getElementById('mermaid-code'),
    diagramTitle: document.getElementById('diagram-title'),
    diagramMetaDesc: document.getElementById('diagram-meta-desc'),
    canvasViewport: document.getElementById('canvas-viewport'),
    mermaidRenderContainer: document.getElementById('mermaid-render-container'),
    dictionaryBody: document.getElementById('dictionary-body'),
    themeToggle: document.getElementById('theme-toggle'),
    accordionTrigger: document.getElementById('accordion-trigger'),
    accordionContent: document.getElementById('accordion-content'),
    accordionSection: document.getElementById('code-editor-section'),
    btnExportSvg: document.getElementById('btn-export-svg'),
    btnExportPng: document.getElementById('btn-export-png'),
    zoomIn: document.getElementById('zoom-in'),
    zoomOut: document.getElementById('zoom-out'),
    zoomReset: document.getElementById('zoom-reset'),
    apiStatus: document.getElementById('api-status'),
    apiIndicator: document.querySelector('.status-indicator'),
    apiLabel: document.querySelector('.status-label'),
    toastContainer: document.getElementById('toast-container'),
    templateButtons: document.querySelectorAll('.template-selector .btn')
};

// Debounce helper
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Show Toast Notification
function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Add brief icon
    let icon = '';
    if (type === 'success') icon = '✓';
    else if (type === 'error') icon = '✗';
    else icon = 'ℹ';
    
    toast.innerHTML = `<span>${icon}</span> <p>${message}</p>`;
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Check API status
async function checkApiStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        if (data.status === 'configured') {
            elements.apiStatus.className = 'api-status-badge connected';
            elements.apiIndicator.style.backgroundColor = '#10b981';
            elements.apiLabel.textContent = 'API Connected';
        } else {
            elements.apiStatus.className = 'api-status-badge error';
            elements.apiIndicator.style.backgroundColor = '#ef4444';
            elements.apiLabel.textContent = 'API Key Missing';
            showToast("Azure OpenAI configuration not loaded. Check your .env file.", "error");
        }
    } catch (error) {
        elements.apiStatus.className = 'api-status-badge error';
        elements.apiIndicator.style.backgroundColor = '#ef4444';
        elements.apiLabel.textContent = 'Server Offline';
        showToast("Cannot connect to FastAPI backend.", "error");
    }
}

// Initialize Mermaid.js
function initMermaid() {
    const theme = elements.html.getAttribute('data-theme');
    mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'neutral',
        securityLevel: 'loose',
        flowchart: {
            useMaxWidth: false,
            htmlLabels: false
        }
    });
}

// Render Mermaid code to SVG
async function renderDiagram(code) {
    if (!code) return;
    
    // Clear and set container
    elements.mermaidRenderContainer.innerHTML = `<div class="mermaid" id="mermaid-svg-target">${code}</div>`;
    
    try {
        await mermaid.run({
            nodes: document.querySelectorAll('#mermaid-svg-target')
        });
        
        // Post-render styling adjustments to make diagrams look premium
        const svg = elements.mermaidRenderContainer.querySelector('svg');
        if (svg) {
            svg.style.width = '100%';
            svg.style.height = 'auto';
            svg.style.maxHeight = '80vh';
            // Enable interactive dragging cursor
            svg.style.cursor = 'grab';
        }
        
        resetZoomAndPan();
    } catch (error) {
        console.error("Mermaid Render Error:", error);
        elements.mermaidRenderContainer.innerHTML = `
            <div class="empty-state">
                <h3 style="color: var(--accent-orange)">Mermaid Rendering Issue</h3>
                <p>The code is syntactically invalid or failed to draw. You can manually adjust it in the Live Editor below.</p>
                <pre style="text-align: left; background: var(--bg-input); padding: 12px; border-radius: var(--border-radius-sm); overflow: auto; max-width: 100%; font-size: 11px; color: var(--accent-orange); border: 1px solid var(--border-color);">${error.message || error}</pre>
            </div>
        `;
    }
}

// Generate DFD from Requirements via backend API
async function generateDFD() {
    const text = elements.requirementsInput.value.trim();
    if (!text) {
        showToast("Please enter some requirements first.", "error");
        return;
    }
    
    // Set loading state
    elements.btnGenerate.disabled = true;
    elements.btnText.textContent = "Analyzing & Drawing...";
    elements.loader.classList.remove('hidden');
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requirements: text })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Server error occurred during generation");
        }
        
        const result = await response.json();
        
        // Update Title & Meta
        elements.diagramTitle.textContent = result.title || "Generated Data Flow Diagram";
        elements.diagramMetaDesc.textContent = result.description || "Parsed workflow diagram";
        
        // Get layout orientation from select dropdown
        let finalCode = result.mermaid;
        const selectedDir = elements.flowDirection.value;
        // Override direction if different
        if (finalCode.includes("flowchart TD") && selectedDir === "LR") {
            finalCode = finalCode.replace("flowchart TD", "flowchart LR");
        } else if (finalCode.includes("flowchart LR") && selectedDir === "TD") {
            finalCode = finalCode.replace("flowchart LR", "flowchart TD");
        }
        
        // Update Live Editor Code
        appState.currentMermaidCode = finalCode;
        elements.mermaidCode.value = finalCode;
        
        // Render
        await renderDiagram(finalCode);
        
        // Populate dictionary
        appState.components = result.components || [];
        populateDictionary(result.components);
        
        showToast("Diagram generated successfully!", "success");
        
    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
    } finally {
        elements.btnGenerate.disabled = false;
        elements.btnText.textContent = "Generate Diagram";
        elements.loader.classList.add('hidden');
    }
}

// Populate the DFD Dictionary table
function populateDictionary(components) {
    if (!components || components.length === 0) {
        elements.dictionaryBody.innerHTML = `
            <tr>
                <td colspan="3" class="table-empty">No components identified.</td>
            </tr>
        `;
        return;
    }
    
    elements.dictionaryBody.innerHTML = components.map(c => {
        const typeLower = (c.type || '').toLowerCase().replace('/', '');
        let badgeClass = 'badge-process';
        if (typeLower.includes('store') || typeLower.includes('data')) badgeClass = 'badge-datastore';
        else if (typeLower.includes('decision')) badgeClass = 'badge-decision';
        else if (typeLower.includes('entity') || typeLower.includes('input')) badgeClass = 'badge-entity';
        else if (typeLower.includes('start') || typeLower.includes('end')) badgeClass = 'badge-startend';
        
        return `
            <tr>
                <td style="font-weight: 700; color: var(--text-primary); font-family: var(--font-heading);">${escapeHtml(c.name)}</td>
                <td><span class="badge ${badgeClass}">${escapeHtml(c.type)}</span></td>
                <td>${escapeHtml(c.description)}</td>
            </tr>
        `;
    }).join('');
}

// HTML Escaping Utility
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Canvas Zoom & Pan Mechanics
function applyZoomPan() {
    elements.mermaidRenderContainer.style.transform = `translate(${appState.panX}px, ${appState.panY}px) scale(${appState.zoom})`;
}

function resetZoomAndPan() {
    appState.zoom = 1;
    appState.panX = 0;
    appState.panY = 0;
    applyZoomPan();
}

function initCanvasControls() {
    // Mouse Down - Start Drag
    elements.canvasViewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('select') || e.target.closest('textarea')) return;
        
        appState.isDragging = true;
        elements.canvasViewport.style.cursor = 'grabbing';
        
        appState.startX = e.clientX - appState.panX;
        appState.startY = e.clientY - appState.panY;
    });

    // Mouse Move - Dragging
    window.addEventListener('mousemove', (e) => {
        if (!appState.isDragging) return;
        appState.panX = e.clientX - appState.startX;
        appState.panY = e.clientY - appState.startY;
        applyZoomPan();
    });

    // Mouse Up - End Drag
    window.addEventListener('mouseup', () => {
        if (appState.isDragging) {
            appState.isDragging = false;
            elements.canvasViewport.style.cursor = 'grab';
        }
    });

    // Wheel - Zoom
    elements.canvasViewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = 0.08;
        if (e.deltaY < 0) {
            appState.zoom = Math.min(appState.zoom + factor, 3.5);
        } else {
            appState.zoom = Math.max(appState.zoom - factor, 0.25);
        }
        applyZoomPan();
    }, { passive: false });

    // Click Controls
    elements.zoomIn.addEventListener('click', () => {
        appState.zoom = Math.min(appState.zoom + 0.15, 3.5);
        applyZoomPan();
    });

    elements.zoomOut.addEventListener('click', () => {
        appState.zoom = Math.max(appState.zoom - 0.15, 0.25);
        applyZoomPan();
    });

    elements.zoomReset.addEventListener('click', resetZoomAndPan);
}

function prepareSvgForExport(svgElement) {
    const clone = svgElement.cloneNode(true);
    
    // Get numeric dimensions from bounding client rect
    const bbox = svgElement.getBoundingClientRect();
    const width = bbox.width || 800;
    const height = bbox.height || 600;
    
    clone.setAttribute('width', width);
    clone.setAttribute('height', height);
    
    // Get current theme to export correct text colors
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const textColor = theme === 'dark' ? '#f8fafc' : '#0f172a';
    
    // Hardcode the required diagram custom colors directly to avoid scanning external stylesheets
    const dfdStyles = `
        .process rect, .process circle, .process polygon, .process path, .process .label-container {
            fill: rgba(124, 58, 237, 0.08) !important;
            stroke: #7c3aed !important;
            stroke-width: 2px !important;
        }
        .datastore rect, .datastore circle, .datastore polygon, .datastore path, .datastore .label-container {
            fill: rgba(6, 182, 212, 0.08) !important;
            stroke: #06b6d4 !important;
            stroke-width: 2px !important;
        }
        .decision rect, .decision circle, .decision polygon, .decision path, .decision .label-container {
            fill: rgba(249, 115, 22, 0.08) !important;
            stroke: #f97316 !important;
            stroke-width: 2px !important;
        }
        .startend rect, .startend circle, .startend polygon, .startend path, .startend .label-container {
            fill: rgba(148, 163, 184, 0.08) !important;
            stroke: #94a3b8 !important;
            stroke-width: 2px !important;
        }
        .process text, .process tspan, .process .nodeLabel,
        .datastore text, .datastore tspan, .datastore .nodeLabel,
        .decision text, .decision tspan, .decision .nodeLabel,
        .startend text, .startend tspan, .startend .nodeLabel {
            color: ${textColor} !important;
            fill: ${textColor} !important;
        }
    `;
    
    // Inject the styles inside a <style> block inside the SVG
    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.textContent = dfdStyles;
    clone.insertBefore(styleElement, clone.firstChild);
    
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clone);
    
    // Add XML standard namespaces if not present
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)) {
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
    
    // Clean up cross-origin assets to avoid "tainted canvas" error
    // Remove all @import rules (handles missing semicolons, quotes, spaces, etc.)
    source = source.replace(/@import\s+[^;}]*;?/gi, '');
    
    // Remove all @font-face rules (handles multi-line and spaces)
    source = source.replace(/@font-face\s*\{[\s\S]*?\}/gi, '');
    
    return source;
}

// Exports
function exportSvg() {
    const svgElement = elements.mermaidRenderContainer.querySelector('svg');
    if (!svgElement) {
        showToast("No diagram available to export.", "error");
        return;
    }
    
    try {
        let source = prepareSvgForExport(svgElement);
        // Add XML declaration
        source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
        
        const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'data-flow-diagram.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        showToast("SVG exported successfully!", "success");
    } catch (error) {
        console.error(error);
        showToast("Failed to export SVG.", "error");
    }
}

function exportPng() {
    const svgElement = elements.mermaidRenderContainer.querySelector('svg');
    if (!svgElement) {
        showToast("No diagram available to export.", "error");
        return;
    }
    
    try {
        const source = prepareSvgForExport(svgElement);
        
        // Use SVG blob URL
        const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const url = window.URL.createObjectURL(svgBlob);
        
        const image = new Image();
        
        image.onload = () => {
            const canvas = document.createElement('canvas');
            
            // Adjust resolution scale (higher resolution)
            const scale = 2;
            const bbox = svgElement.getBoundingClientRect();
            const width = bbox.width || 800;
            const height = bbox.height || 600;
            
            canvas.width = width * scale;
            canvas.height = height * scale;
            
            const context = canvas.getContext('2d');
            
            // Render background matching theme
            const theme = elements.html.getAttribute('data-theme');
            context.fillStyle = theme === 'dark' ? '#0a0f1d' : '#f1f5f9';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            context.scale(scale, scale);
            context.drawImage(image, 0, 0, width, height);
            
            const pngUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = pngUrl;
            link.download = 'data-flow-diagram.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            showToast("PNG exported successfully!", "success");
        };
        
        image.onerror = (e) => {
            console.error("Image loading error: ", e);
            showToast("Failed to load SVG for PNG generation.", "error");
        };
        
        image.src = url;
    } catch (error) {
        console.error(error);
        showToast("Failed to export PNG.", "error");
    }
}

// Setup Event Listeners
function setupEvents() {
    // Generate Button Click
    elements.btnGenerate.addEventListener('click', generateDFD);
    
    // Theme Toggle
    elements.themeToggle.addEventListener('click', () => {
        const currentTheme = elements.html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        elements.html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Re-initialize Mermaid theme and re-render
        initMermaid();
        if (appState.currentMermaidCode) {
            renderDiagram(appState.currentMermaidCode);
        }
    });

    // Accordion Code Editor toggle
    elements.accordionTrigger.addEventListener('click', () => {
        elements.accordionTrigger.classList.toggle('active');
        elements.accordionContent.classList.toggle('hidden');
    });

    // Live Editor code input (debounced rendering)
    elements.mermaidCode.addEventListener('input', debounce((e) => {
        appState.currentMermaidCode = e.target.value;
        renderDiagram(appState.currentMermaidCode);
        showToast("Live rendering updated", "info", 1500);
    }, 600));

    // Template Button clicks
    elements.templateButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.templateButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const templateKey = btn.getAttribute('data-template');
            if (TEMPLATES[templateKey]) {
                elements.requirementsInput.value = TEMPLATES[templateKey];
                showToast(`Loaded ${btn.textContent} template`, "info", 2000);
                generateDFD(); // Automatically generate diagram when switching templates
            }
        });
    });

    // Export buttons
    elements.btnExportSvg.addEventListener('click', exportSvg);
    elements.btnExportPng.addEventListener('click', exportPng);

    // Dropdown Layout Direction override
    elements.flowDirection.addEventListener('change', () => {
        let code = appState.currentMermaidCode;
        if (!code) return;
        
        const val = elements.flowDirection.value;
        if (val === 'LR' && code.includes('flowchart TD')) {
            code = code.replace('flowchart TD', 'flowchart LR');
        } else if (val === 'TD' && code.includes('flowchart LR')) {
            code = code.replace('flowchart LR', 'flowchart TD');
        }
        
        appState.currentMermaidCode = code;
        elements.mermaidCode.value = code;
        renderDiagram(code);
    });
}

// Initialize adjustable grid layout resizers
function initResizers() {
    const resizerX = document.getElementById('resizer-x');
    const resizerY = document.getElementById('resizer-y');
    const appContainer = document.querySelector('.app-container');
    
    if (!resizerX || !resizerY || !appContainer) return;
    
    // Vertical resizer (X)
    resizerX.addEventListener('mousedown', (e) => {
        e.preventDefault();
        resizerX.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        
        function onMouseMove(moveEvent) {
            const containerRect = appContainer.getBoundingClientRect();
            let newWidth = moveEvent.clientX - containerRect.left - 3;
            // Clamp sidebar width between 300px and half of the container width
            newWidth = Math.max(300, Math.min(newWidth, containerRect.width / 2));
            document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
        }
        
        function onMouseUp() {
            resizerX.classList.remove('dragging');
            document.body.style.cursor = 'default';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });
    
    // Horizontal resizer (Y)
    resizerY.addEventListener('mousedown', (e) => {
        e.preventDefault();
        resizerY.classList.add('dragging');
        document.body.style.cursor = 'row-resize';
        
        function onMouseMove(moveEvent) {
            const containerRect = appContainer.getBoundingClientRect();
            let newHeight = containerRect.bottom - moveEvent.clientY - 3;
            // Clamp footer height between 100px and 450px
            newHeight = Math.max(100, Math.min(newHeight, 450));
            document.documentElement.style.setProperty('--footer-height', `${newHeight}px`);
        }
        
        function onMouseUp() {
            resizerY.classList.remove('dragging');
            document.body.style.cursor = 'default';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });
}

// Initial Loading Logic
document.addEventListener('DOMContentLoaded', () => {
    // Load persisted theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    elements.html.setAttribute('data-theme', savedTheme);
    
    initResizers();
    initMermaid();
    setupEvents();
    initCanvasControls();
    checkApiStatus();
});
