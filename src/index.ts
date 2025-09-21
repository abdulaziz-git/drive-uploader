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
    if (url.pathname === "/api/upload" || request.method === "POST") {
      // Continue to POST handler below
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
        const form = await request.formData();
        const file = form.get("file");

        if (!(file instanceof File)) {
          return json({ error: "No file uploaded" }, 400);
        }

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

      <!-- Upload Form -->
      <form id="uploadForm" class="space-y-4">
        <div class="space-y-2">
          <label for="file" class="text-sm font-medium text-foreground">Choose File</label>
          <div class="relative">
            <input 
              type="file" 
              id="file" 
              name="file" 
              required 
              class="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
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

    // Utility function to format file sizes
    function formatFileSize(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const fileInput = document.getElementById('file');
      if (!fileInput.files[0]) {
        showError('Please select a file to upload');
        return;
      }

      const file = fileInput.files[0];
      showLoading(file.size);
      
      try {
        // Step 1: Get upload session from Cloudflare Worker
        const formData = new FormData(form);
        const sessionResponse = await fetch('', { 
          method: 'POST', 
          body: formData 
        });
        
        const sessionData = await sessionResponse.json();
        
        if (!sessionResponse.ok || !sessionData.ok) {
          showError(sessionData.error || 'Failed to initialize upload. Please try again.');
          hideLoading();
          return;
        }
        
        // Step 2: Upload directly to Google Drive via our CORS proxy
        const xhr = new XMLHttpRequest();
        
        // Track upload progress to Google Drive (this is real progress!)
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            updateProgress(e.loaded, e.total);
          }
        });
        
        // Handle completion
        xhr.addEventListener('load', () => {
          try {
            if (xhr.status === 200) {
              // Upload successful, try to parse the response to get file ID
              let uploadedFileId = null;
              try {
                const responseData = JSON.parse(xhr.responseText);
                uploadedFileId = responseData.id;
              } catch (parseError) {
                console.log('Could not parse upload response:', parseError);
              }
              
              // Use the file ID from upload response, fallback to session data
              const finalFileId = uploadedFileId || sessionData.fileId;
              
              if (finalFileId) {
                getFileDetailsWithRetry(finalFileId, sessionData.filename);
              } else {
                // Create fallback file details when no fileId is available
                const fallbackFile = {
                  name: sessionData.filename,
                  size: sessionData.size,
                  mimeType: sessionData.mimeType,
                  createdTime: new Date().toISOString(),
                  modifiedTime: null,
                  id: 'File ID not available - upload completed successfully',
                  webViewLink: null
                };
                showFileDetails(fallbackFile);
                form.reset();
              }
            } else {
              showError('Upload to Google Drive failed. Please try again.');
            }
          } catch (error) {
            // Even if we can't parse the response, the upload might have succeeded
            if (sessionData.fileId) {
              getFileDetailsWithRetry(sessionData.fileId, sessionData.filename);
            } else {
              showError('Invalid response from Google Drive. Please try again.');
            }
          } finally {
            hideLoading();
          }
        });
        
        // Handle errors
        xhr.addEventListener('error', () => {
          // Upload might still succeed, check file details
          if (sessionData.fileId) {
            getFileDetailsWithRetry(sessionData.fileId, sessionData.filename);
          } else {
            showError('Network error uploading to Google Drive. Please try again.');
          }
          hideLoading();
        });
        
        // Handle abort
        xhr.addEventListener('abort', () => {
          showError('Upload was cancelled.');
          hideLoading();
        });
        
        // Convert Google Drive session URL to use our CORS proxy
        const originalUrl = new URL(sessionData.sessionUrl);
        const proxyPath = originalUrl.pathname.replace('/upload/', '/api/proxy/upload/');
        const proxyUrl = proxyPath + originalUrl.search;
        
        xhr.open('PUT', proxyUrl);
        xhr.setRequestHeader('Content-Type', sessionData.mimeType);
        xhr.send(file);
        
      } catch (error) {
        showError('Failed to initialize upload. Please try again.');
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
  
  try {
    const response = await fetch(googleUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
    });
    
    // Create response with CORS headers
    const responseHeaders = {
      ...corsHeaders(),
      ...(response.headers.get("content-type") && {
        "content-type": response.headers.get("content-type")!
      })
    };
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
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

async function safeText(resp: Response) {
  try { return await resp.text(); } catch { return "<no body>"; }
}
