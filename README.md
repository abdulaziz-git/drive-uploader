# Google Drive Uploader - Cloudflare Workers

A professional file uploader that allows users to upload files directly to Google Drive through a Cloudflare Worker, featuring real-time progress tracking and a beautiful UI.

## ✨ Features

- **Direct Google Drive Upload** - Files upload directly to Google Drive with real progress tracking
- **CORS Proxy Authentication** - Cloudflare Worker handles authentication while maintaining direct upload
- **Real-time Progress** - See actual upload progress to Google Drive, not just to the proxy
- **Embedded UI** - Clean, modern interface embedded directly in the Worker with file type icons and detailed success feedback
- **Service Account Integration** - Secure server-side authentication using Google Service Account
- **File Details Display** - Complete file information including Google Drive file ID and direct links
- **Copy File ID** - One-click copying of Google Drive file IDs for API usage
- **Error Handling** - Comprehensive error handling with user-friendly messages

## 🏗️ Architecture

```
Browser → Cloudflare Worker → Google Drive API
   ↑            ↓                    ↓
   └─────── CORS Proxy ──────────────┘
```

1. **Frontend** uploads file metadata to Cloudflare Worker
2. **Worker** creates Google Drive resumable upload session
3. **Frontend** uploads directly to Google Drive via Worker's CORS proxy
4. **Progress tracking** shows real Google Drive upload progress
5. **Success display** shows complete file details with Drive links

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
├── wrangler.jsonc          # Extended Wrangler configuration
└── wrangler.toml           # Wrangler configuration
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_EMAIL` | Service account email | ✅ |
| `GOOGLE_PRIVATE_KEY` | Service account private key | ✅ |
| `GOOGLE_PRIVATE_KEY_ID` | Private key ID | ❌ |
| `DRIVE_FOLDER_ID` | Target Google Drive folder ID | ❌ |

### Worker Configuration (`wrangler.toml`)

```toml
name = "cf-workers-uploader-gd"
main = "src/index.ts"
compatibility_date = "2023-12-01"

[env.production]
# Production environment variables
```

## 🎨 UI Components

### Upload Form
- File selection with drag & drop support
- Real-time file validation
- Upload progress bar with percentage and file size
- Cancel upload functionality

### Success Display
- Professional card layout with gradient header
- File type icons (📦 for ZIP, 📄 for PDF, etc.)
- Comprehensive file details grid:
  - File name and MIME type
  - File size and upload date
  - Upload status and platform
  - Google Drive file ID
- Action buttons for opening in Drive and copying file ID

### Error Handling
- Network error detection
- Upload failure notifications
- Retry mechanisms with exponential backoff
- User-friendly error messages

## 🔒 Security Features

- **Server-side Authentication** - Google access tokens never exposed to browser
- **CORS Proxy** - Secure proxy for Google Drive API calls
- **Input Validation** - File type and size validation
- **Error Sanitization** - Safe error message handling

## 📡 API Endpoints

### `POST /` (File Upload)
Accepts multipart form data with file and returns upload session details.

**Request:**
```
Content-Type: multipart/form-data
file: [File object]
```

**Response:**
```json
{
  "ok": true,
  "sessionUrl": "https://www.googleapis.com/upload/drive/v3/files/...",
  "accessToken": "ya29.xxx",
  "fileId": "1BxCyDzE2FgH3IjK4LmN5OpQ6RsT7UvW8XyZ9",
  "filename": "document.pdf",
  "mimeType": "application/pdf",
  "size": 1048576
}
```

### `GET /api/file-details?fileId={id}`
Retrieves detailed file information from Google Drive.

**Response:**
```json
{
  "ok": true,
  "file": {
    "id": "1BxCyDzE2FgH3IjK4LmN5OpQ6RsT7UvW8XyZ9",
    "name": "document.pdf",
    "size": "1048576",
    "webViewLink": "https://drive.google.com/file/d/.../view",
    "createdTime": "2025-01-01T12:00:00.000Z",
    "mimeType": "application/pdf"
  }
}
```

### `PUT /api/proxy/upload/drive/v3/files/...`
CORS proxy for direct Google Drive uploads.

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

## 🔄 Upload Flow

1. **User selects file** → Frontend validates file
2. **POST to Worker** → Creates resumable upload session
3. **Extract file ID** → From session URL or response
4. **Direct upload** → Via CORS proxy to Google Drive
5. **Progress tracking** → Real-time upload progress
6. **Completion** → Fetch file details and display results

## 🚨 Troubleshooting

### Common Issues

**"File ID not available"**
- Check if service account has proper Drive permissions
- Verify the resumable upload session is created successfully
- Enable debug logging to see session URL format

**CORS Errors**
- Ensure all uploads go through the `/api/proxy/` endpoint
- Check that CORS headers are properly set in Worker

**Authentication Failures**
- Verify service account credentials are correct
- Check that private key includes proper line breaks
- Ensure service account has Drive API access

**Upload Failures**
- Check file size limits (Google Drive: 5TB max)
- Verify internet connectivity
- Check browser console for detailed error messages

### Debug Mode

Enable debug logging by uncommenting console.log statements in the Worker:
```javascript
console.log('Session URL:', sessionUrl);
console.log('Extracted File ID:', fileId);
```

## 📈 Performance Optimization

- **Direct Upload** - No double upload (browser → Worker → Drive)
- **Resumable Uploads** - Handles large files and network interruptions
- **Progress Streaming** - Real-time progress updates
- **Efficient CORS Proxy** - Minimal overhead for API calls

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
