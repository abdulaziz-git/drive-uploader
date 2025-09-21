# Google Drive Uploader - Cloudflare Workers

A professional Progressive Web App (PWA) that allows users to upload files directly to Google Drive through a Cloudflare Worker, featuring real-time progress tracking, universal file support, and a beautiful modern UI.

## ✨ Features

- **Universal File Support** - Upload ANY file type with proper MIME type handling
- **Progressive Web App** - Installable PWA with professional icons and manifest
- **Chunked Upload Support** - Upload files up to 5TB using intelligent chunk-based uploading
- **No File Size Limits** - Overcome Cloudflare Workers' 100MB limit with automatic chunking
- **Real-time Progress** - See actual upload progress with chunk-by-chunk tracking
- **Direct Google Drive Upload** - Files upload directly to Google Drive using resumable upload API
- **Professional UI** - Clean, modern interface with your custom app icon
- **File Associations** - Set as default handler for any file type
- **Share Target** - Accept files shared from other apps
- **Service Account Integration** - Secure server-side authentication using Google Service Account
- **Professional File Details** - Complete file information with Google Drive file ID and direct links
- **Copy File ID** - One-click copying of Google Drive file IDs for API usage
- **Smart Error Handling** - Per-chunk validation with detailed error messages
- **Memory Efficient** - Only 10MB chunks in memory at a time, regardless of file size

## 📊 Google Drive Limits

According to [Google's official documentation](https://support.google.com/a/answer/172541?hl=en), there are important limits to be aware of:

### File Size Limits
- **Maximum file size**: 5TB per individual file
- **Upload/sync limit**: Files up to 5TB can be uploaded and synchronized

### Daily Upload Limits  
- **750GB per user per 24 hours**: Each user can upload and copy up to 750GB within 24 hours
- **Limit refresh**: The limit refreshes within 24 hours after reaching it
- **Copy restrictions**: Files larger than 750GB cannot be copied (must download then re-upload)

### Practical Implications
- **Large files (>750GB)**: Will consume your entire daily allowance
- **Multiple uploads**: Plan multiple file uploads across different days if needed
- **Service accounts**: Each service account has its own 750GB daily limit

## 🏗️ Architecture

### Chunked Upload Flow
```
Large File (5GB) → Split into 500 chunks (10MB each)
                      ↓
Browser → Worker → Google Drive Resumable API
   ↑        ↓           ↓
   └── Chunk 1-500 ────┘
```

### Upload Process
1. **File Analysis** - Frontend splits large files into 10MB chunks
2. **Session Creation** - Worker creates Google Drive resumable upload session  
3. **Chunked Upload** - Each chunk uploaded sequentially through Worker
4. **Progress Tracking** - Real-time progress with chunk-by-chunk updates
5. **File Assembly** - Google Drive automatically assembles complete file
6. **Success Display** - Professional file details with Drive links

## 🚀 Quick Start

### Prerequisites

- Cloudflare Workers account
- Google Cloud Platform account with Drive API enabled
- Google Service Account with Drive access

### 1. Google Cloud Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable Google Drive API**
   ```bash
   # Via gcloud CLI
   gcloud services enable drive.googleapis.com
   ```

3. **Create Service Account**
   - Go to IAM & Admin → Service Accounts
   - Click "Create Service Account"
   - Download the JSON key file

4. **Share Drive Folder** (Optional)
   - Create a folder in Google Drive
   - Share it with your service account email
   - Copy the folder ID from the URL

### 2. Cloudflare Workers Setup

1. **Clone and Install**
   ```bash
   git clone <your-repo>
   cd cf-workers-uploader-gd
   npm install
   ```

2. **Configure Environment Variables**
   
   Create `.dev.vars` file:
   ```env
   GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"
   GOOGLE_PRIVATE_KEY_ID=your-key-id
   DRIVE_FOLDER_ID=your-google-drive-folder-id
   ```

   Set production secrets:
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_EMAIL
   npx wrangler secret put GOOGLE_PRIVATE_KEY
   npx wrangler secret put GOOGLE_PRIVATE_KEY_ID
   npx wrangler secret put DRIVE_FOLDER_ID
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```

## 📁 Project Structure

```
cf-workers-uploader-gd/
├── src/
│   └── index.ts              # Main Worker script with embedded HTML
├── public/
│   ├── manifest.json         # PWA manifest with universal file support
│   └── icons/                # Professional app icons
│       ├── favicon.ico       # Browser tab icon
│       ├── icon-192.png      # Standard PWA icon
│       ├── icon-512.png      # High-res PWA icon
│       ├── icon-192-maskable.png # Android adaptive icon
│       ├── icon-512-maskable.png # High-res Android adaptive icon
│       └── apple-touch-icon.png  # iOS home screen icon
├── test/
│   ├── index.spec.ts        # Tests
│   ├── env.d.ts            # Test environment types
│   └── tsconfig.json       # Test TypeScript config
├── .editorconfig            # Editor configuration
├── .gitignore              # Git ignore rules
├── .prettierrc             # Prettier configuration
├── .vscode/
│   └── settings.json       # VS Code settings
├── package.json            # Node.js dependencies
├── README.md               # Project documentation
├── tsconfig.json           # TypeScript configuration
├── vitest.config.mts       # Test configuration
├── worker-configuration.d.ts # Worker type definitions
└── wrangler.jsonc          # Wrangler configuration with assets binding
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_EMAIL` | Service account email | ✅ |
| `GOOGLE_PRIVATE_KEY` | Service account private key | ✅ |
| `GOOGLE_PRIVATE_KEY_ID` | Private key ID | ❌ |
| `DRIVE_FOLDER_ID` | Target Google Drive folder ID | ❌ |

### Worker Configuration (`wrangler.jsonc`)

```jsonc
{
  "name": "drive-uploader",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-21",
  "compatibility_flags": [
    "global_fetch_strictly_public"
  ],
  "assets": {
    "directory": "./public"
  },
  "observability": {
    "enabled": true
  }
  // Note: Use secrets to store sensitive data with `wrangler secret put`
  // No environment variables here—set them with `wrangler secret put`
}
```

### Static Assets Configuration
The `wrangler.jsonc` includes an assets binding that serves your `public/` directory, which contains:
- `manifest.json` - PWA manifest file
- `icons/` - All your professional app icons
- Any other static assets

## 🎨 UI Components

### Professional Header
- **Custom App Icon** - Your professional 512x512 PNG icon prominently displayed
- **Modern Typography** - Clean, readable app title and description
- **Responsive Design** - Optimized for all screen sizes and devices

### Upload Form
- **Modern File Input** - shadcn/ui styled drag-and-drop zone
- **Universal File Support** - Accept ANY file type with proper MIME handling
- **Drag & Drop Support** - Visual feedback with hover states
- **Instant File Preview** - Real-time file details display
- **Size Limits** - Up to 5TB files supported (Google Drive per-file limit)
- **Daily Limits** - 750GB total upload limit per user per 24 hours
- **Smart Warnings** - Confirmation for files larger than 1GB
- **Real-time Validation** - Immediate feedback on file selection

### Configurable Upload Settings
- **Chunk Size Selection** - Choose from 1MB to 100MB chunk sizes
- **Performance Tuning** - Balance between speed and request count
- **Auto-calculation** - Real-time chunk count estimation for selected files
- **Settings Persistence** - User preferences saved in browser localStorage
- **Cloudflare Limit Aware** - Maximum 100MB chunks (Cloudflare Workers limit)

### File Preview & Details
- **Instant Preview** - File details appear immediately upon selection
- **Smart File Icons** - Dynamic icons based on file type (🖼️ images, 🎥 videos, 📦 archives, etc.)
- **Upload Strategy Display** - Shows chunk size and estimated chunk count
- **Clear File Button** - Easy file deselection with X button
- **Responsive Grid** - File size and chunk estimation in organized layout

### Chunked Upload Progress
- **Chunk Progress** - "45% (Chunk 90/200)" display
- **Data Transfer** - Shows uploaded/total bytes
- **Visual Progress Bar** - Real-time progress animation
- **Upload Speed** - Optimized 10MB chunks for best performance

### Success Display
- **Professional Card Layout** - Clean, modern design with gradient header
- **File Type Icons** - Dynamic icons (📦 ZIP, 📄 PDF, 🖼️ Images, etc.)
- **Comprehensive Details Grid**:
  - File name and MIME type
  - File size and upload timestamp
  - Upload status and platform
  - Google Drive file ID (copy-enabled)
- **Action Buttons** - Direct Drive link and file ID copying

### Professional Alert Dialogs
- **shadcn/ui Design System** - Modern, accessible dialog components
- **Context-Aware Warnings** - Different styles for file size vs daily limits
- **Smart Animations** - Smooth fade and scale transitions
- **Rich Information Display** - File details, chunk estimation, and warnings
- **Keyboard Accessible** - Full keyboard navigation and ESC to close
- **Visual Hierarchy** - Color-coded icons (🟠 info, 🔴 warning)

### Error Handling
- **Per-chunk Validation** - Individual chunk error reporting
- **Smart Recovery** - Clear error messages with chunk numbers
- **Upload Termination** - Graceful handling of failures
- **Detailed Logging** - Worker logs for troubleshooting

## 📱 Progressive Web App (PWA) Features

### Professional App Icons
- **Browser Tab Icon** - Custom favicon.ico for browser tabs and bookmarks
- **PWA Icons** - 192x192 and 512x512 PNG icons for app installation
- **Android Adaptive Icons** - Maskable icons that adapt to Android's theming
- **iOS Home Screen** - Apple touch icon for iOS home screen installation
- **High Quality** - All icons are crisp and professional at any size

### Universal File Support
- **File Handlers** - Set as default app for opening ANY file type
- **Share Target** - Accept files shared from other apps
- **MIME Type Support** - Proper handling of all file types with `application/octet-stream`
- **Cross-Platform** - Works on desktop, mobile, and tablet devices

### PWA Installation
- **Installable** - Users can install your app on their device
- **Standalone Mode** - Runs like a native app without browser UI
- **App Shortcuts** - Quick access to upload functionality
- **Offline Ready** - Basic functionality works offline (with service worker)

### Manifest Configuration
```json
{
  "name": "Upload to Google Drive",
  "short_name": "Drive Uploader",
  "display": "standalone",
  "file_handlers": [
    {
      "action": "/",
      "accept": {
        "application/octet-stream": [".*"]
      }
    }
  ],
  "share_target": {
    "action": "/",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [
        {
          "name": "file",
          "accept": ["*/*"]
        }
      ]
    }
  }
}
```

## 🔒 Security Features

- **Server-side Authentication** - Google access tokens never exposed to browser
- **CORS Proxy** - Secure proxy for Google Drive API calls
- **Input Validation** - File type and size validation
- **Error Sanitization** - Safe error message handling

## 📡 API Endpoints

### `POST /api/upload-init` (Initialize Chunked Upload)
Creates a resumable upload session for chunked uploads.

**Request:**
```json
{
  "filename": "largefile.zip",
  "mimeType": "application/zip",
  "size": 2147483648
}
```

**Response:**
```json
{
  "ok": true,
  "sessionUrl": "https://www.googleapis.com/upload/drive/v3/files/...",
  "filename": "largefile.zip",
  "mimeType": "application/zip",
  "size": 2147483648
}
```

### `POST /api/upload-chunk` (Upload File Chunk)
Uploads individual chunks of the file.

**Headers:**
```
Content-Type: application/octet-stream
X-Session-Url: [resumable session URL]
X-Chunk-Start: 10485760
X-Chunk-End: 20971519
X-Total-Size: 2147483648
X-Is-Last-Chunk: false
```

**Response (Continue):**
```json
{
  "ok": true,
  "status": "continue"
}
```

**Response (Complete):**
```json
{
  "ok": true,
  "status": "complete",
  "fileData": {
    "id": "1BxCyDzE2FgH3IjK4LmN5OpQ6RsT7UvW8XyZ9",
    "name": "largefile.zip",
    "size": "2147483648",
    "webViewLink": "https://drive.google.com/file/d/.../view"
  }
}
```

### `GET /api/file-details?fileId={id}`
Retrieves detailed file information from Google Drive.

### `POST /` (Legacy Single Upload)
Legacy endpoint for files under 100MB (still supported).

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Development mode (with hot reload)
npm run dev

# Deploy to production
npm run deploy

# Generate Cloudflare Worker types
npm run cf-typegen
```

## 🔄 Chunked Upload Flow

### Small Files (< 10MB)
1. **File Selection** → Frontend validates file size and type
2. **Single Chunk** → File uploaded as one 10MB-or-less chunk
3. **Progress Display** → Shows "100% (Chunk 1/1)"
4. **Completion** → File details displayed immediately

### Large Files (> 10MB)
1. **File Selection** → Frontend validates file (up to 5TB per file, 750GB daily limit)
2. **Chunk Analysis** → File split into 10MB chunks
3. **Session Creation** → Worker creates Google Drive resumable session
4. **Sequential Upload** → Each chunk uploaded individually:
   ```
   Chunk 1/200 → Worker → Google Drive (10MB)
   Chunk 2/200 → Worker → Google Drive (10MB)
   ...
   Chunk 200/200 → Worker → Google Drive (final chunk)
   ```
5. **Progress Tracking** → Real-time "45% (Chunk 90/200)" display
6. **File Assembly** → Google Drive assembles complete file
7. **Completion** → Professional file details with Drive link

### Error Recovery
- **Chunk-level Errors** → "Chunk 45 upload failed: [reason]"
- **Network Issues** → Clear error messages with retry guidance
- **Session Expiry** → Automatic session refresh (when possible)

## 🚨 Troubleshooting

### Common Issues

**"Chunk X upload failed"**
- Check network connectivity during upload
- Monitor Worker logs: `npx wrangler tail`
- Verify service account has proper Drive permissions
- Large files may need multiple attempts

**"Upload session initialization failed"**
- Verify Google Service Account credentials
- Check that Drive API is enabled in Google Cloud Console
- Ensure service account has access to target folder

**"File too large" (> 5TB)**
- Google Drive has a 5TB per-file limit
- Consider splitting very large files
- Use compression if applicable

**"Daily upload limit exceeded"**
- Google Drive limits users to 750GB uploads per 24 hours
- Wait for the limit to refresh (within 24 hours)
- Monitor your daily upload usage
- Consider spreading large uploads across multiple days

**Slow Upload Performance**
- Large files upload in 10MB chunks sequentially
- Network speed affects chunk upload time
- Monitor progress: each chunk should complete within 1-2 minutes

### Debug Mode

Monitor real-time upload progress:
```bash
# Watch Worker logs in real-time
npx wrangler tail

# You'll see logs like:
# Initializing chunked upload: largefile.zip, size: 2147483648 bytes
# Uploading chunk: bytes 0-10485759/2147483648, last: false
# Chunk upload response: 308 Resume Incomplete
# Upload completed, file ID: 1BxCyDzE2FgH3IjK4LmN5OpQ6RsT7UvW8XyZ9
```

### Performance Tips

- **Optimal File Sizes**: 10MB-1GB files upload fastest
- **Network Stability**: Ensure stable internet for large uploads
- **Browser Tab**: Keep upload tab active and visible
- **Chunk Size Tuning**: 
  - **1-5MB**: Fast individual chunks, more HTTP requests
  - **10-25MB**: Balanced performance (recommended)
  - **50-100MB**: Slower chunks, fewer requests (good for very stable connections)

## 📈 Performance Optimization

### Chunked Upload Benefits
- **Memory Efficient** - Only 10MB in memory per chunk, regardless of file size
- **No Worker Limits** - Bypasses Cloudflare's 100MB request body limit
- **Scalable Architecture** - Handles files from 1KB to 5TB equally well
- **Daily Limit Aware** - Respects Google Drive's 750GB per 24-hour limit
- **Network Resilient** - Individual chunk failures don't restart entire upload

### Upload Performance
- **Sequential Processing** - Chunks upload one at a time for reliability
- **Google Drive Native** - Uses Google's resumable upload protocol
- **Real-time Progress** - Granular progress tracking per chunk
- **Minimal Overhead** - Worker acts as lightweight proxy only

### Resource Usage
- **CPU Efficient** - No file processing, just data forwarding
- **Memory Light** - 10MB maximum memory usage per upload
- **Network Optimized** - Direct browser-to-Drive data flow
- **Cost Effective** - Minimal Worker CPU time per chunk

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Search existing [GitHub Issues](https://github.com/your-repo/issues)
3. Create a new issue with detailed error messages and steps to reproduce

## 🙏 Acknowledgments

- [Cloudflare Workers](https://workers.cloudflare.com/) for the serverless platform
- [Google Drive API](https://developers.google.com/drive/api) for file storage
- [Tailwind CSS](https://tailwindcss.com/) for the beautiful UI styling

---

**Made with ❤️ using Cloudflare Workers and Google Drive API**
