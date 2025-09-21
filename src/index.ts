export interface Env {
  GOOGLE_CLIENT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string; // Store with literal \n or real newlines
  GOOGLE_PRIVATE_KEY_ID?: string;
  DRIVE_FOLDER_ID?: string;   // Optional: Google Drive folder ID
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle API routes
    if (url.pathname === "/api/upload-init" && request.method === "POST") {
      // Initialize chunked upload session
      return await handleUploadInit(request, env);
    } else if (url.pathname === "/api/upload-chunk" && request.method === "POST") {
      // Handle individual chunk upload
      return await handleChunkUpload(request, env);
    } else if (url.pathname === "/api/upload" || request.method === "POST") {
      // Continue to POST handler below (legacy single upload)
    } else if (url.pathname === "/api/file-details" && request.method === "GET") {
      // Handle file details request
      const fileId = url.searchParams.get("fileId");
      if (!fileId) {
        return json({ error: "File ID is required" }, 400);
      }
      
      try {
        const accessToken = await getAccessToken(env);
        const fileDetails = await getFileDetails(accessToken, fileId);
        return json({ ok: true, file: fileDetails });
      } catch (err: any) {
        return json({ error: err?.message || String(err) }, 500);
      }
    } else if (url.pathname.startsWith("/api/proxy/")) {
      // CORS proxy for Google Drive API calls
      return await handleGoogleDriveProxy(request, env);
    } else if (request.method === "GET") {
      // For GET requests to root, serve the HTML directly
      if (url.pathname === "/") {
        return new Response(getHtml(), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      // For other GET requests, return 404
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "OPTIONS") {
      // CORS preflight (allow posting from your own origin if you serve HTML elsewhere)
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method === "POST") {
      try {
        // Check content length early to avoid processing huge requests
        const contentLength = request.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) { // 100MB limit
          return json({ error: "File too large. Maximum size is 100MB." }, 413);
        }

        const form = await request.formData();
        const file = form.get("file");

        if (!(file instanceof File)) {
          return json({ error: "No file uploaded" }, 400);
        }

        // Additional file size check
        if (file.size > 100 * 1024 * 1024) { // 100MB limit
          return json({ error: "File too large. Maximum size is 100MB." }, 413);
        }

        console.log(`Processing upload: ${file.name}, size: ${file.size} bytes`);

        // Get access token using service account JWT
        const accessToken = await getAccessToken(env);

        // Create resumable upload session
        const sessionUrl = await createResumableSession({
          accessToken,
          filename: file.name || "upload.bin",
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          folderId: env.DRIVE_FOLDER_ID,
          supportsAllDrives: true,
        });

        // Extract file ID from session URL for later retrieval
        const fileId = extractFileIdFromSessionUrl(sessionUrl);
        
        // Debug logging
        console.log('Session URL:', sessionUrl);
        console.log('Extracted File ID:', fileId);
        console.log('Upload session created successfully');

        // Return the session URL and access token for direct upload
        return json({ 
          ok: true, 
          sessionUrl,
          accessToken,
          fileId,
          filename: file.name || "upload.bin",
          mimeType: file.type || "application/octet-stream",
          size: file.size
        });
      } catch (err: any) {
        console.error('Upload initialization error:', err);
        return json({ error: err?.message || String(err) }, 500);
      }
    }

    return json({ error: "Method not allowed" }, 405);
  },
};

// ---- Helpers ----

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders() },
  });
}

function getHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Upload to Google Drive</title>
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          border: "hsl(214.3 31.8% 91.4%)",
          input: "hsl(214.3 31.8% 91.4%)",
          ring: "hsl(222.2 84% 4.9%)",
          background: "hsl(0 0% 100%)",
          foreground: "hsl(222.2 84% 4.9%)",
          primary: {
            DEFAULT: "hsl(222.2 47.4% 11.2%)",
            foreground: "hsl(210 40% 98%)",
          },
          secondary: {
            DEFAULT: "hsl(210 40% 96%)",
            foreground: "hsl(222.2 84% 4.9%)",
          },
          destructive: {
            DEFAULT: "hsl(0 84.2% 60.2%)",
            foreground: "hsl(210 40% 98%)",
          },
          muted: {
            DEFAULT: "hsl(210 40% 96%)",
            foreground: "hsl(215.4 16.3% 46.9%)",
          },
          accent: {
            DEFAULT: "hsl(210 40% 96%)",
            foreground: "hsl(222.2 84% 4.9%)",
          },
          popover: {
            DEFAULT: "hsl(0 0% 100%)",
            foreground: "hsl(222.2 84% 4.9%)",
          },
          card: {
            DEFAULT: "hsl(0 0% 100%)",
            foreground: "hsl(222.2 84% 4.9%)",
          },
        },
        borderRadius: {
          lg: "0.5rem",
          md: "calc(0.5rem - 2px)",
          sm: "calc(0.5rem - 4px)",
        },
      }
    }
  }
</script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  * {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
  
  /* Dialog animations */
  @keyframes dialog-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes dialog-fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  
  @keyframes dialog-scale-in {
    from { 
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.95);
    }
    to { 
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
  
  @keyframes dialog-scale-out {
    from { 
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    to { 
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.95);
    }
  }
  
  [data-state="open"] {
    animation: dialog-fade-in 200ms ease-out;
  }
  
  [data-state="closed"] {
    animation: dialog-fade-out 150ms ease-in;
  }
  
  [data-state="open"] > div {
    animation: dialog-scale-in 200ms ease-out;
  }
  
  [data-state="closed"] > div {
    animation: dialog-scale-out 150ms ease-in;
  }
  
  .animate-spin {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: .5; }
  }
</style>
</head>
<body class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <div class="bg-white rounded-lg shadow-lg border border-border p-6 space-y-6">
      <!-- Header -->
      <div class="text-center space-y-2">
        <div class="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto">
          <svg class="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-foreground">Upload to Google Drive</h1>
        <p class="text-muted-foreground text-sm">Select a file and upload directly to your Drive folder</p>
      </div>

      <!-- Settings Panel -->
      <div class="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-foreground">Upload Settings</h3>
          <button type="button" id="toggleSettings" class="text-xs text-muted-foreground hover:text-foreground">
            <span id="settingsToggleText">Hide</span>
            <svg id="settingsIcon" class="inline w-3 h-3 ml-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
        </div>
        
        <div id="settingsContent" class="space-y-3">
          <div class="space-y-2">
            <label for="chunkSize" class="text-xs font-medium text-foreground">Chunk Size</label>
            <select 
              id="chunkSize" 
              class="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="1048576">1 MB (Fast, more requests)</option>
              <option value="5242880">5 MB (Balanced)</option>
              <option value="10485760" selected>10 MB (Default, recommended)</option>
              <option value="26214400">25 MB (Slower, fewer requests)</option>
              <option value="52428800">50 MB (Large chunks)</option>
              <option value="104857600">100 MB (Maximum, Cloudflare limit)</option>
            </select>
            <p class="text-xs text-muted-foreground">
              Larger chunks = fewer requests but slower individual uploads. 
              <span class="font-medium">100MB is Cloudflare Workers' maximum request size.</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Upload Form -->
      <form id="uploadForm" class="space-y-6">
        <div class="space-y-2">
          <label for="file" class="text-sm font-medium text-foreground">Choose File</label>
          <div class="relative">
            <!-- Hidden file input -->
            <input 
              type="file" 
              id="file" 
              name="file" 
              required 
              class="sr-only"
              accept="*/*"
            />
            
            <!-- Custom file input button -->
            <label for="file" class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-input rounded-lg cursor-pointer bg-background hover:bg-accent/50 transition-colors group">
              <div class="flex flex-col items-center justify-center pt-5 pb-6">
                <svg class="w-8 h-8 mb-3 text-muted-foreground group-hover:text-foreground transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <p class="mb-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  <span class="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p class="text-xs text-muted-foreground">Any file up to 5TB</p>
              </div>
            </label>
          </div>
        </div>
        
        <!-- File Details Preview -->
        <div id="filePreview" class="hidden space-y-3">
          <div class="flex items-center gap-2 text-sm font-medium text-foreground">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Selected File
          </div>
          
          <div class="bg-accent/30 border border-border rounded-lg p-4 space-y-3">
            <!-- File Name and Icon -->
            <div class="flex items-start gap-3">
              <span id="previewFileIcon" class="text-2xl">📄</span>
              <div class="flex-1 min-w-0">
                <h4 id="previewFileName" class="font-medium text-foreground break-all leading-tight">filename.txt</h4>
                <p id="previewMimeType" class="text-sm text-muted-foreground mt-1">text/plain</p>
              </div>
              <button type="button" id="clearFile" class="text-muted-foreground hover:text-foreground transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <!-- File Details Grid -->
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt class="text-muted-foreground">File Size</dt>
                <dd id="previewFileSize" class="font-medium text-foreground">--</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Estimated Chunks</dt>
                <dd id="previewChunkCount" class="font-medium text-foreground">--</dd>
              </div>
            </div>
            
            <!-- Upload Strategy -->
            <div class="pt-2 border-t border-border/50">
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <span id="previewStrategy">Chunked upload with 10MB chunks</span>
              </div>
            </div>
          </div>
        </div>
        
        <button 
          type="submit" 
          id="submitBtn"
          class="w-full bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-2 focus:ring-ring focus:ring-offset-2 font-medium rounded-md px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <span id="btnText">Upload File</span>
          <svg id="loadingIcon" class="w-4 h-4 animate-spin hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </button>
      </form>

      <!-- Progress Bar -->
      <div id="progressContainer" class="hidden space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Uploading...</span>
          <span id="progressText" class="text-muted-foreground">0%</span>
        </div>
        <div class="w-full bg-secondary rounded-full h-2">
          <div id="progressBar" class="bg-primary h-2 rounded-full transition-all duration-300 ease-out" style="width: 0%"></div>
        </div>
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span id="uploadedSize">0 B</span>
          <span id="totalSize">0 B</span>
        </div>
      </div>

      <!-- Status Message -->
      <div id="statusMessage" class="hidden">
        <div id="successMessage" class="hidden">
          <div id="successDetails"></div>
        </div>
        
        <div id="errorMessage" class="hidden p-4 rounded-md bg-red-50 border border-red-200">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            <div class="text-sm">
              <p class="font-medium text-red-800">Upload Failed</p>
              <p id="errorDetails" class="text-red-700"></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Alert Dialog for Large File Confirmation -->
  <div id="alertDialog" class="fixed inset-0 z-50 hidden bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" role="dialog" aria-modal="true">
    <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
      <!-- Dialog Header -->
      <div class="flex flex-col space-y-1.5 text-center sm:text-left">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <svg class="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          <div>
            <h2 id="alertTitle" class="text-lg font-semibold leading-none tracking-tight text-foreground">
              Large File Upload
            </h2>
            <p class="text-sm text-muted-foreground mt-1">
              Please confirm this upload
            </p>
          </div>
        </div>
      </div>
      
      <!-- Dialog Content -->
      <div class="py-4">
        <p id="alertMessage" class="text-sm text-foreground leading-relaxed">
          <!-- Message will be set dynamically -->
        </p>
        
        <!-- File Info -->
        <div id="alertFileInfo" class="mt-4 rounded-lg bg-gray-50 p-3">
          <div class="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            File Details
          </div>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Name:</span>
              <span id="alertFileName" class="font-medium text-foreground">--</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Size:</span>
              <span id="alertFileSize" class="font-medium text-foreground">--</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Estimated Chunks:</span>
              <span id="alertFileChunks" class="font-medium text-foreground">--</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Dialog Actions -->
      <div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
        <button id="alertCancel" type="button" class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 mt-2 sm:mt-0">
          Cancel
        </button>
        <button id="alertContinue" type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
          Continue Upload
        </button>
      </div>
    </div>
  </div>

  <script>
    const form = document.getElementById('uploadForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const loadingIcon = document.getElementById('loadingIcon');
    const statusMessage = document.getElementById('statusMessage');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const successDetails = document.getElementById('successDetails');
    const errorDetails = document.getElementById('errorDetails');
    
    // Progress bar elements
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const uploadedSize = document.getElementById('uploadedSize');
    const totalSize = document.getElementById('totalSize');
    
    // Settings elements
    const toggleSettings = document.getElementById('toggleSettings');
    const settingsContent = document.getElementById('settingsContent');
    const settingsIcon = document.getElementById('settingsIcon');
    const settingsToggleText = document.getElementById('settingsToggleText');
    const chunkSizeSelect = document.getElementById('chunkSize');
    
    // Alert Dialog elements
    const alertDialog = document.getElementById('alertDialog');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const alertFileName = document.getElementById('alertFileName');
    const alertFileSize = document.getElementById('alertFileSize');
    const alertFileChunks = document.getElementById('alertFileChunks');
    const alertCancel = document.getElementById('alertCancel');
    const alertContinue = document.getElementById('alertContinue');
    
    // File Preview elements
    const fileInput = document.getElementById('file');
    const filePreview = document.getElementById('filePreview');
    const previewFileIcon = document.getElementById('previewFileIcon');
    const previewFileName = document.getElementById('previewFileName');
    const previewMimeType = document.getElementById('previewMimeType');
    const previewFileSize = document.getElementById('previewFileSize');
    const previewChunkCount = document.getElementById('previewChunkCount');
    const previewStrategy = document.getElementById('previewStrategy');
    const clearFileBtn = document.getElementById('clearFile');

    // Settings panel functionality
    let settingsVisible = true;
    
    toggleSettings.addEventListener('click', () => {
      settingsVisible = !settingsVisible;
      if (settingsVisible) {
        settingsContent.classList.remove('hidden');
        settingsIcon.style.transform = 'rotate(0deg)';
        settingsToggleText.textContent = 'Hide';
      } else {
        settingsContent.classList.add('hidden');
        settingsIcon.style.transform = 'rotate(-90deg)';
        settingsToggleText.textContent = 'Show';
      }
    });
    
    // Load saved chunk size from localStorage
    const savedChunkSize = localStorage.getItem('uploadChunkSize');
    if (savedChunkSize && chunkSizeSelect) {
      chunkSizeSelect.value = savedChunkSize;
    }
    
    
    // Update chunk info when file is selected
    function updateChunkInfo() {
      const fileInput = document.getElementById('file');
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const chunkSize = getChunkSize();
        const totalChunks = Math.ceil(file.size / chunkSize);
        
        // Update the help text to show estimated chunks for current file
        const helpText = document.querySelector('#chunkSize + p');
        if (helpText) {
          helpText.innerHTML = \`
            Larger chunks = fewer requests but slower individual uploads. 
            <span class="font-medium">100MB is Cloudflare Workers' maximum request size.</span>
          \`;
        }
      }
    }
    
    // File input event listeners
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        showFilePreview(file);
        updateChunkInfo();
      } else {
        hideFilePreview();
      }
    });
    
    // Clear file button
    clearFileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearFileSelection();
    });
    
    // Settings change should update preview if file is selected
    chunkSizeSelect.addEventListener('change', () => {
      localStorage.setItem('uploadChunkSize', chunkSizeSelect.value);
      console.log(\`Chunk size changed to: \${formatFileSize(parseInt(chunkSizeSelect.value))}\`);
      updateChunkInfo();
      
      // Update preview if file is selected
      if (fileInput.files && fileInput.files[0]) {
        showFilePreview(fileInput.files[0]);
      }
    });
    
    // Drag and drop functionality
    const dropZone = document.querySelector('label[for="file"]');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight(e) {
      dropZone.classList.add('border-primary', 'bg-primary/5');
    }
    
    function unhighlight(e) {
      dropZone.classList.remove('border-primary', 'bg-primary/5');
    }
    
    dropZone.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
      const dt = e.dataTransfer;
      const files = dt.files;
      
      if (files.length > 0) {
        fileInput.files = files;
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
      }
    }

    // Utility function to format file sizes
    function formatFileSize(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    // Get selected chunk size
    function getChunkSize() {
      return parseInt(chunkSizeSelect.value) || (10 * 1024 * 1024); // Default 10MB
    }
    
    // Get file icon based on MIME type
    function getFileIcon(mimeType) {
      if (!mimeType) return '📄';
      
      // Images
      if (mimeType.startsWith('image/')) return '🖼️';
      
      // Videos
      if (mimeType.startsWith('video/')) return '🎥';
      
      // Audio
      if (mimeType.startsWith('audio/')) return '🎵';
      
      // Documents
      if (mimeType.includes('pdf')) return '📕';
      if (mimeType.includes('word') || mimeType.includes('document')) return '📘';
      if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📗';
      if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📙';
      if (mimeType.includes('text/')) return '📄';
      
      // Archives
      if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || 
          mimeType.includes('tar') || mimeType.includes('gzip')) return '📦';
      
      // Code files
      if (mimeType.includes('javascript') || mimeType.includes('json') || 
          mimeType.includes('xml') || mimeType.includes('html')) return '📋';
      
      // Default
      return '📄';
    }
    
    // Show file preview
    function showFilePreview(file) {
      const chunkSize = getChunkSize();
      const totalChunks = Math.ceil(file.size / chunkSize);
      
      // Update preview content
      previewFileIcon.textContent = getFileIcon(file.type);
      previewFileName.textContent = file.name || 'Unknown file';
      previewMimeType.textContent = file.type || 'Unknown type';
      previewFileSize.textContent = formatFileSize(file.size);
      previewChunkCount.textContent = totalChunks + ' chunks';
      previewStrategy.textContent = \`Chunked upload with \${formatFileSize(chunkSize)} chunks\`;
      
      // Show preview
      filePreview.classList.remove('hidden');
    }
    
    // Hide file preview
    function hideFilePreview() {
      filePreview.classList.add('hidden');
    }
    
    // Clear file selection
    function clearFileSelection() {
      fileInput.value = '';
      hideFilePreview();
      // Reset any error states
      statusMessage.classList.add('hidden');
    }
    
    // Alert Dialog functionality
    function showAlertDialog(title, message, fileName, fileSize, chunkCount, iconType = 'info') {
      return new Promise((resolve) => {
        // Set dialog content
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        alertFileName.textContent = fileName;
        alertFileSize.textContent = formatFileSize(fileSize);
        alertFileChunks.textContent = chunkCount + ' chunks';
        
        // Update icon and colors based on type
        const iconContainer = alertDialog.querySelector('.flex.h-10.w-10');
        const iconSvg = iconContainer.querySelector('svg');
        
        if (iconType === 'warning') {
          iconContainer.className = 'flex h-10 w-10 items-center justify-center rounded-full bg-red-100';
          iconSvg.className = 'h-5 w-5 text-red-600';
          iconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>';
        } else {
          iconContainer.className = 'flex h-10 w-10 items-center justify-center rounded-full bg-amber-100';
          iconSvg.className = 'h-5 w-5 text-amber-600';
          iconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>';
        }
        
        // Show dialog
        alertDialog.classList.remove('hidden');
        alertDialog.setAttribute('data-state', 'open');
        
        // Focus the continue button
        alertContinue.focus();
        
        // Handle events
        const handleCancel = () => {
          hideAlertDialog();
          resolve(false);
        };
        
        const handleContinue = () => {
          hideAlertDialog();
          resolve(true);
        };
        
        const handleEscape = (e) => {
          if (e.key === 'Escape') {
            handleCancel();
          }
        };
        
        // Add event listeners
        alertCancel.addEventListener('click', handleCancel, { once: true });
        alertContinue.addEventListener('click', handleContinue, { once: true });
        document.addEventListener('keydown', handleEscape, { once: true });
        
        // Close on backdrop click
        alertDialog.addEventListener('click', (e) => {
          if (e.target === alertDialog) {
            handleCancel();
          }
        }, { once: true });
      });
    }
    
    function hideAlertDialog() {
      alertDialog.setAttribute('data-state', 'closed');
      setTimeout(() => {
        alertDialog.classList.add('hidden');
      }, 200); // Match the animation duration
    }

    function showLoading(fileSize) {
      submitBtn.disabled = true;
      btnText.textContent = 'Uploading...';
      loadingIcon.classList.remove('hidden');
      statusMessage.classList.add('hidden');
      
      // Show progress bar
      progressContainer.classList.remove('hidden');
      progressBar.style.width = '0%';
      progressText.textContent = '0%';
      uploadedSize.textContent = '0 B';
      totalSize.textContent = formatFileSize(fileSize);
    }

    function hideLoading() {
      submitBtn.disabled = false;
      btnText.textContent = 'Upload File';
      loadingIcon.classList.add('hidden');
      progressContainer.classList.add('hidden');
    }

    function updateProgress(loaded, total) {
      const percentage = Math.round((loaded / total) * 100);
      progressBar.style.width = percentage + '%';
      progressText.textContent = percentage + '%';
      uploadedSize.textContent = formatFileSize(loaded);
    }

    function showSuccess(message) {
      successDetails.innerHTML = message;
      successMessage.classList.remove('hidden');
      errorMessage.classList.add('hidden');
      statusMessage.classList.remove('hidden');
    }

    function formatDate(dateString) {
      if (!dateString) return 'Unknown';
      const date = new Date(dateString);
      return date.toLocaleString();
    }

    function showFileDetails(file) {
      const fileName = file.name || 'Unknown file';
      const fileSize = formatFileSize(file.size);
      const uploadDate = formatDate(file.createdTime);
      const driveLink = file.webViewLink;
      const fileId = file.id;
      const mimeType = file.mimeType || 'Unknown';
      
      // Get file type icon based on MIME type
      const getFileIcon = (mimeType) => {
        if (mimeType.includes('image/')) return '🖼️';
        if (mimeType.includes('video/')) return '🎥';
        if (mimeType.includes('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
        if (mimeType.includes('text/') || mimeType.includes('document')) return '📝';
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
        if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📑';
        return '📁';
      };
      
      const fileIcon = getFileIcon(mimeType);
      
      let detailsHtml = \`
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden max-w-md mx-auto">
          <!-- Header -->
          <div class="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <div>
                <h3 class="text-white font-semibold text-lg">Upload Successful</h3>
                <p class="text-green-100 text-sm">File uploaded to Google Drive</p>
              </div>
            </div>
          </div>
          
          <!-- File Details -->
          <div class="p-6 space-y-4">
            <!-- File Name with Icon -->
            <div class="flex items-center gap-3 pb-4 border-b border-gray-100">
              <span class="text-3xl">\${fileIcon}</span>
              <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-gray-900 text-lg break-all leading-tight">\${fileName}</h4>
                <p class="text-gray-500 text-sm mt-1">\${mimeType}</p>
              </div>
            </div>
            
            <!-- Details Grid -->
            <div class="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <dt class="text-gray-500 font-medium mb-1">File Size</dt>
                <dd class="text-gray-900 font-semibold text-base">\${fileSize}</dd>
              </div>
              <div>
                <dt class="text-gray-500 font-medium mb-1">Status</dt>
                <dd class="text-green-600 font-semibold flex items-center gap-2">
                  <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                  Uploaded
                </dd>
              </div>
              <div>
                <dt class="text-gray-500 font-medium mb-1">Upload Date</dt>
                <dd class="text-gray-900">\${uploadDate}</dd>
              </div>
              <div>
                <dt class="text-gray-500 font-medium mb-1">Platform</dt>
                <dd class="text-gray-900 flex items-center gap-2">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                  </svg>
                  Google Drive
                </dd>
              </div>
            </div>
            
            <!-- File ID -->
            <div class="bg-gray-50 rounded-lg p-4 mt-6">
              <dt class="text-gray-500 font-medium text-xs uppercase tracking-wide mb-3">File ID</dt>
              <dd class="font-mono text-sm text-gray-700 break-all bg-white px-3 py-2 rounded border">\${fileId}</dd>
            </div>
            
            <!-- Actions -->
            <div class="flex gap-3 pt-4">
              \${driveLink ? \`
                <a href="\${driveLink}" target="_blank" rel="noopener" 
                   class="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                  Open in Drive
                </a>
              \` : \`
                <div class="flex-1 inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-500 px-4 py-3 rounded-lg font-medium">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                  </svg>
                  Link Unavailable
                </div>
              \`}
              
              <button onclick="copyFileId('\${fileId}')" 
                      class="inline-flex items-center gap-2 bg-gray-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                Copy ID
              </button>
            </div>
          </div>
        </div>
      \`;
      
      successDetails.innerHTML = detailsHtml;
      successMessage.classList.remove('hidden');
      errorMessage.classList.add('hidden');
      statusMessage.classList.remove('hidden');
    }

    // Helper function to copy file ID to clipboard
    function copyFileId(fileId) {
      navigator.clipboard.writeText(fileId).then(() => {
        // Show temporary feedback
        const button = event.target.closest('button');
        const originalText = button.innerHTML;
        button.innerHTML = \`
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          Copied!
        \`;
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 2000);
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = fileId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        const button = event.target.closest('button');
        const originalText = button.innerHTML;
        button.innerHTML = \`
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          Copied!
        \`;
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 2000);
      });
    }

    function showError(message) {
      errorDetails.textContent = message;
      errorMessage.classList.remove('hidden');
      successMessage.classList.add('hidden');
      statusMessage.classList.remove('hidden');
    }

    async function getFileDetailsWithRetry(fileId, fallbackFilename, maxRetries = 5) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(\`/api/file-details?fileId=\${fileId}\`);
          const data = await response.json();
          
          if (data.ok && data.file) {
            const file = data.file;
            showFileDetails(file);
            form.reset();
            return;
          }
        } catch (error) {
          console.log(\`Attempt \${attempt} failed to get file details:\`, error);
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
      
      // If all retries failed, show success with fallback message
      const fallbackFile = {
        name: fallbackFilename,
        size: null,
        mimeType: 'Unknown',
        createdTime: new Date().toISOString(),
        modifiedTime: null,
        id: fileId || 'File ID retrieval failed',
        webViewLink: null
      };
      showFileDetails(fallbackFile);
      form.reset();
    }

    async function uploadFileInChunks(file) {
      const CHUNK_SIZE = getChunkSize(); // Get user-selected chunk size
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      try {
        // Step 1: Initialize upload session
        const initResponse = await fetch('/api/upload-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size
          })
        });
        
        const sessionData = await initResponse.json();
        if (!initResponse.ok || !sessionData.ok) {
          throw new Error(sessionData.error || 'Failed to initialize upload session');
        }
        
        console.log(\`Starting chunked upload: \${totalChunks} chunks of \${formatFileSize(CHUNK_SIZE)}\`);
        
        // Update progress text to show chunked upload
        progressText.textContent = \`0% (Chunk 1/\${totalChunks})\`;
        
        // Step 2: Upload chunks sequentially
        let uploadedBytes = 0;
        let finalFileData = null;
        
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const isLastChunk = chunkIndex === totalChunks - 1;
          
          console.log(\`Uploading chunk \${chunkIndex + 1}/\${totalChunks}: bytes \${start}-\${end - 1}\`);
          
          // Upload this chunk
          const chunkResponse = await fetch('/api/upload-chunk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'X-Session-Url': sessionData.sessionUrl,
              'X-Chunk-Start': start.toString(),
              'X-Chunk-End': (end - 1).toString(),
              'X-Total-Size': file.size.toString(),
              'X-Is-Last-Chunk': isLastChunk.toString()
            },
            body: chunk
          });
          
          if (!chunkResponse.ok) {
            const errorData = await chunkResponse.json().catch(() => ({}));
            throw new Error(\`Chunk \${chunkIndex + 1} upload failed: \${errorData.error || chunkResponse.statusText}\`);
          }
          
          uploadedBytes += chunk.size;
          const percentage = Math.round((uploadedBytes / file.size) * 100);
          progressBar.style.width = percentage + '%';
          progressText.textContent = \`\${percentage}% (Chunk \${chunkIndex + 1}/\${totalChunks})\`;
          uploadedSize.textContent = formatFileSize(uploadedBytes);
          
          // If this was the last chunk, get the file details
          if (isLastChunk) {
            const result = await chunkResponse.json();
            if (result.fileData) {
              finalFileData = result.fileData;
            }
          }
        }
        
        // Step 3: Show success with file details
        if (finalFileData) {
          showFileDetails(finalFileData);
        } else {
          // Fallback success message
          const fallbackFile = {
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            createdTime: new Date().toISOString(),
            modifiedTime: null,
            id: 'Upload completed successfully',
            webViewLink: null
          };
          showFileDetails(fallbackFile);
        }
        
        form.reset();
        hideLoading();
        
      } catch (error) {
        console.error('Chunked upload error:', error);
        throw error;
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const fileInput = document.getElementById('file');
      if (!fileInput.files[0]) {
        showError('Please select a file to upload');
        return;
      }

      const file = fileInput.files[0];
      
      // Set maximum file size (Google Drive per-file limit)
      const maxSize = 5 * 1024 * 1024 * 1024 * 1024; // 5TB (Google Drive per-file limit)
      if (file.size > maxSize) {
        showError(\`File too large. Maximum size is \${formatFileSize(maxSize)}. Your file is \${formatFileSize(file.size)}.\`);
        return;
      }
      
      // Warn for very large files
      if (file.size > 1024 * 1024 * 1024) { // 1GB
        const dailyLimit = 750 * 1024 * 1024 * 1024; // 750GB daily limit
        const chunkSize = getChunkSize();
        const totalChunks = Math.ceil(file.size / chunkSize);
        
        let title, message, icon;
        if (file.size > dailyLimit) {
          title = "Daily Upload Limit Exceeded";
          message = \`This file (\${formatFileSize(file.size)}) exceeds Google Drive's 750GB daily upload limit. You may need to wait up to 24 hours between uploads. Do you want to continue anyway?\`;
          icon = 'warning'; // Red warning for limit exceeded
        } else {
          title = "Large File Upload";
          message = \`This is a very large file (\${formatFileSize(file.size)}). Upload may take considerable time and will be split into \${totalChunks} chunks. Do you want to continue?\`;
          icon = 'info'; // Amber info for large file
        }
        
        const shouldContinue = await showAlertDialog(
          title,
          message,
          file.name,
          file.size,
          totalChunks,
          icon
        );
        
        if (!shouldContinue) {
          return;
        }
      }
      
      showLoading(file.size);
      
      try {
        // Use chunked upload for all files
        await uploadFileInChunks(file);
        
      } catch (error) {
        showError(\`Upload failed: \${error.message}\`);
        hideLoading();
      }
    });
  </script>
</body>
</html>`;
}


interface ResumableSessionArgs {
  accessToken: string;
  filename: string;
  mimeType: string;
  size: number;
  folderId?: string;
  supportsAllDrives?: boolean;
}

interface DriveFileMetadata {
  name: string;
  parents?: string[];
}

async function createResumableSession(args: ResumableSessionArgs): Promise<string> {
  const metadata: DriveFileMetadata = {
    name: args.filename,
  };
  if (args.folderId) metadata.parents = [args.folderId];

  const url = new URL("https://www.googleapis.com/upload/drive/v3/files");
  url.searchParams.set("uploadType", "resumable");
  url.searchParams.set("fields", "id,name,size,webViewLink,createdTime,modifiedTime,mimeType");
  if (args.supportsAllDrives) {
    url.searchParams.set("supportsAllDrives", "true");
  }

  const init = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${args.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": args.mimeType,
      "X-Upload-Content-Length": String(args.size),
    },
    body: JSON.stringify(metadata),
  });

  if (!init.ok) {
    const text = await safeText(init);
    throw new Error(`Failed to start resumable session (${init.status}): ${text}`);
  }

  const loc = init.headers.get("Location");
  if (!loc) throw new Error("Google did not return resumable session Location header");
  return loc;
}

async function handleGoogleDriveProxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }
  
  // Extract the Google Drive URL from the proxy path
  // /api/proxy/upload/drive/v3/files -> https://www.googleapis.com/upload/drive/v3/files
  const pathParts = url.pathname.split('/');
  const proxyIndex = pathParts.indexOf('proxy');
  
  if (proxyIndex === -1 || proxyIndex + 1 >= pathParts.length) {
    return json({ error: "Invalid proxy path" }, 400);
  }
  
  const googleApiPath = pathParts.slice(proxyIndex + 1).join('/');
  const googleUrl = new URL(`https://www.googleapis.com/${googleApiPath}`);
  
  // Copy query parameters
  for (const [key, value] of url.searchParams) {
    googleUrl.searchParams.set(key, value);
  }
  
  console.log(`Proxying ${request.method} request to: ${googleUrl.toString()}`);
  
  // Get access token
  const accessToken = await getAccessToken(env);
  
  // Forward the request to Google Drive API
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${accessToken}`);
  
  // Copy relevant headers from original request
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  
  const contentLength = request.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);
  
  // Copy other important headers for resumable uploads
  const uploadContentType = request.headers.get("x-upload-content-type");
  if (uploadContentType) headers.set("x-upload-content-type", uploadContentType);
  
  const uploadContentLength = request.headers.get("x-upload-content-length");
  if (uploadContentLength) headers.set("x-upload-content-length", uploadContentLength);
  
  try {
    const response = await fetch(googleUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      // Increase timeout for large uploads
      signal: AbortSignal.timeout(300000), // 5 minutes timeout
    });
    
    console.log(`Google Drive API response: ${response.status} ${response.statusText}`);
    
    // Create response with CORS headers
    const responseHeaders: Record<string, string> = {
      ...corsHeaders(),
      ...(response.headers.get("content-type") && {
        "content-type": response.headers.get("content-type")!
      })
    };
    
    // Copy important response headers
    const location = response.headers.get("location");
    if (location) responseHeaders["location"] = location;
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('CORS proxy error:', error);
    return json({ error: error?.message || String(error) }, 500);
  }
}

function extractFileIdFromSessionUrl(sessionUrl: string): string | null {
  try {
    const url = new URL(sessionUrl);
    // Google Drive resumable upload URLs can have different formats:
    // https://www.googleapis.com/upload/drive/v3/files/FILE_ID?uploadType=resumable&upload_id=...
    // https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=...&upload_protocol=resumable
    
    const pathParts = url.pathname.split('/').filter(part => part.length > 0);
    
    // Look for 'files' followed by a file ID
    const filesIndex = pathParts.findIndex(part => part === 'files');
    if (filesIndex >= 0 && filesIndex + 1 < pathParts.length) {
      const potentialFileId = pathParts[filesIndex + 1];
      // Google Drive file IDs are typically alphanumeric and have a specific length
      if (potentialFileId && potentialFileId.length > 10 && /^[a-zA-Z0-9_-]+$/.test(potentialFileId)) {
        return potentialFileId;
      }
    }
    
    // Also check for file ID in query parameters (sometimes it's there)
    const fileIdParam = url.searchParams.get('fileId') || url.searchParams.get('file_id');
    if (fileIdParam) {
      return fileIdParam;
    }
    
    return null;
  } catch (error) {
    console.log('Error extracting file ID from session URL:', error);
    return null;
  }
}

async function getAccessToken(env: Env): Promise<string> {
  const privateKey = normalizePrivateKey(env.GOOGLE_PRIVATE_KEY);
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header: JwtHeader = { alg: "RS256", typ: "JWT" };
  if (env.GOOGLE_PRIVATE_KEY_ID) header.kid = env.GOOGLE_PRIVATE_KEY_ID;
  
  const payload: JwtPayload = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp,
    // If you need to impersonate a Workspace user with domain-wide delegation:
    // sub: "user@yourdomain.com"
  };

  const assertion = await signJwt(header, payload, privateKey);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  
  if (!tokenResp.ok) {
    const text = await safeText(tokenResp);
    throw new Error(`Token exchange failed (${tokenResp.status}): ${text}`);
  }

  const tokenData = await tokenResp.json() as { access_token: string };
  return tokenData.access_token;
}

function normalizePrivateKey(k: string) {
  // Support keys stored with literal "\n" in Workers secrets
  if (k.includes("\\n")) return k.replace(/\\n/g, "\n");
  return k;
}

function b64url(input: ArrayBuffer | string): string {
  if (typeof input === "string") {
    const b64 = btoa(unescape(encodeURIComponent(input)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } else {
    // For ArrayBuffer (binary data), use direct base64 encoding
    const bytes = new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
}

interface JwtHeader {
  alg: string;
  typ: string;
  kid?: string;
}

interface JwtPayload {
  iss: string;
  scope: string;
  aud: string;
  iat: number;
  exp: number;
  sub?: string;
}

async function signJwt(header: JwtHeader, payload: JwtPayload, privateKeyPem: string): Promise<string> {
  const enc = new TextEncoder();
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const arrayBuffer = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    arrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput));
  const sigB64 = b64url(signature);
  
  return `${signingInput}.${sigB64}`;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [\w\s]+-----/g, "")
                 .replace(/-----END [\w\s]+-----/g, "")
                 .replace(/\s+/g, "");
  
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  
  return bytes.buffer;
}

async function getFileDetails(accessToken: string, fileId: string): Promise<any> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  url.searchParams.set('fields', 'id,name,size,webViewLink,createdTime,modifiedTime,mimeType');
  url.searchParams.set('supportsAllDrives', 'true');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await safeText(response);
    throw new Error(`Failed to get file details (${response.status}): ${text}`);
  }

  return await response.json();
}

async function handleUploadInit(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { filename: string; mimeType: string; size: number };
    const { filename, mimeType, size } = body;
    
    if (!filename || !size) {
      return json({ error: "Missing filename or size" }, 400);
    }
    
    console.log(`Initializing chunked upload: ${filename}, size: ${size} bytes`);
    
    // Get access token
    const accessToken = await getAccessToken(env);
    
    // Create resumable upload session
    const sessionUrl = await createResumableSession({
      accessToken,
      filename,
      mimeType: mimeType || "application/octet-stream",
      size,
      folderId: env.DRIVE_FOLDER_ID,
      supportsAllDrives: true,
    });
    
    console.log('Chunked upload session created:', sessionUrl);
    
    return json({
      ok: true,
      sessionUrl,
      filename,
      mimeType,
      size
    });
  } catch (err: any) {
    console.error('Upload init error:', err);
    return json({ error: err?.message || String(err) }, 500);
  }
}

async function handleChunkUpload(request: Request, env: Env): Promise<Response> {
  try {
    const sessionUrl = request.headers.get('X-Session-Url');
    const chunkStart = parseInt(request.headers.get('X-Chunk-Start') || '0');
    const chunkEnd = parseInt(request.headers.get('X-Chunk-End') || '0');
    const totalSize = parseInt(request.headers.get('X-Total-Size') || '0');
    const isLastChunk = request.headers.get('X-Is-Last-Chunk') === 'true';
    
    if (!sessionUrl) {
      return json({ error: "Missing session URL" }, 400);
    }
    
    console.log(`Uploading chunk: bytes ${chunkStart}-${chunkEnd}/${totalSize}, last: ${isLastChunk}`);
    
    const chunkData = await request.arrayBuffer();
    const chunkSize = chunkData.byteLength;
    
    // Validate chunk size doesn't exceed Cloudflare Workers limit
    const MAX_CHUNK_SIZE = 100 * 1024 * 1024; // 100MB
    if (chunkSize > MAX_CHUNK_SIZE) {
      return json({ error: `Chunk size ${chunkSize} bytes exceeds maximum allowed size of ${MAX_CHUNK_SIZE} bytes` }, 413);
    }
    
    // Upload chunk to Google Drive
    const response = await fetch(sessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': chunkSize.toString(),
        'Content-Range': `bytes ${chunkStart}-${chunkEnd}/${totalSize}`
      },
      body: chunkData,
    });
    
    console.log(`Chunk upload response: ${response.status} ${response.statusText}`);
    
    if (response.status === 308) {
      // More chunks expected
      return json({ ok: true, status: 'continue' });
    } else if (response.status === 200 || response.status === 201) {
      // Upload complete
      try {
        const fileData = await response.json() as any;
        console.log('Upload completed, file ID:', fileData.id);
        return json({ ok: true, status: 'complete', fileData });
      } catch (parseError) {
        console.log('Could not parse final response, but upload succeeded');
        return json({ ok: true, status: 'complete' });
      }
    } else {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
    }
  } catch (err: any) {
    console.error('Chunk upload error:', err);
    return json({ error: err?.message || String(err) }, 500);
  }
}

async function safeText(resp: Response) {
  try { return await resp.text(); } catch { return "<no body>"; }
}
