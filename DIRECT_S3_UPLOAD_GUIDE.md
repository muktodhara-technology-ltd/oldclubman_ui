# Direct S3 Upload Guide (Pre-signed URLs)

## Overview

This is the **recommended** approach for file uploads in production. Files are uploaded directly from the browser to S3, bypassing your Laravel server entirely.

### Benefits

✅ **Faster uploads** - Direct to S3 (no PHP proxy)  
✅ **No server load** - Bandwidth goes directly to S3  
✅ **No queue delays** - Instant upload, no job processing  
✅ **No PHP limits** - No memory or timeout issues  
✅ **Better UX** - Real-time progress tracking  
✅ **Scalable** - Handles any number of concurrent uploads  

---

## How It Works

```
1. Frontend requests pre-signed URL from Laravel
2. Laravel generates secure URL (valid for 15 minutes)
3. Frontend uploads file DIRECTLY to S3 using that URL
4. Frontend confirms upload completion to Laravel
5. Laravel updates database status
```

---

## API Endpoints

### 1. Generate Pre-signed URL

**POST** `/api/s3/generate-presigned-url`

**Request:**
```json
{
  "type": "post",
  "file_name": "my-photo.jpg",
  "mime_type": "image/jpeg",
  "file_size": 2048576,
  "parent_id": "post-uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "upload_url": "https://bucket.s3.region.amazonaws.com/path/file.jpg?X-Amz-Signature=...",
    "method": "PUT",
    "s3_key": "post/images/2026/01/1234user-id_5671738012345.jpg",
    "file_name": "1234user-id_5671738012345.jpg",
    "file_type": "image",
    "file_id": "file-record-uuid",
    "upload_status": "pending",
    "expires_at": "2026-01-27T15:30:00Z",
    "headers": {
      "Content-Type": "image/jpeg",
      "x-amz-acl": "public-read"
    }
  }
}
```

### 2. Confirm Upload

**POST** `/api/s3/confirm-upload`

**Request:**
```json
{
  "type": "post",
  "file_id": "file-record-uuid",
  "s3_key": "post/images/2026/01/filename.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "file_id": "file-record-uuid",
    "upload_status": "completed",
    "file_url": "https://bucket.s3.region.amazonaws.com/post/images/2026/01/filename.jpg",
    "s3_key": "post/images/2026/01/filename.jpg"
  }
}
```

### 3. Report Failure

**POST** `/api/s3/upload-failed`

**Request:**
```json
{
  "type": "post",
  "file_id": "file-record-uuid",
  "error_message": "Upload failed: network error"
}
```

---

## Frontend Implementation

### Vanilla JavaScript

```javascript
class S3DirectUpload {
  constructor(apiBaseUrl, authToken) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
  }

  /**
   * Upload file directly to S3
   */
  async uploadFile(file, type, parentId, onProgress) {
    try {
      // Step 1: Get pre-signed URL
      console.log('Getting pre-signed URL...');
      const presignedData = await this.getPresignedUrl(file, type, parentId);
      
      // Step 2: Upload to S3 directly
      console.log('Uploading to S3...');
      await this.uploadToS3(file, presignedData, onProgress);
      
      // Step 3: Confirm upload
      console.log('Confirming upload...');
      const result = await this.confirmUpload(type, presignedData.file_id, presignedData.s3_key);
      
      return result;
      
    } catch (error) {
      console.error('Upload failed:', error);
      
      // Report failure if we have a file_id
      if (error.fileId) {
        await this.reportFailure(type, error.fileId, error.message);
      }
      
      throw error;
    }
  }

  /**
   * Step 1: Get pre-signed URL from Laravel
   */
  async getPresignedUrl(file, type, parentId) {
    const response = await fetch(`${this.apiBaseUrl}/s3/generate-presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        type: type,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        parent_id: parentId,
      }),
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to get pre-signed URL');
    }

    return data.data;
  }

  /**
   * Step 2: Upload file to S3 using pre-signed URL
   */
  async uploadToS3(file, presignedData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            onProgress(percentComplete, e.loaded, e.total);
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 204) {
          resolve();
        } else {
          const error = new Error(`S3 upload failed: ${xhr.status}`);
          error.fileId = presignedData.file_id;
          reject(error);
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        const error = new Error('Network error during S3 upload');
        error.fileId = presignedData.file_id;
        reject(error);
      });

      // Upload to S3
      xhr.open(presignedData.method, presignedData.upload_url);
      
      // Set required headers
      xhr.setRequestHeader('Content-Type', presignedData.headers['Content-Type']);
      xhr.setRequestHeader('x-amz-acl', presignedData.headers['x-amz-acl']);
      
      xhr.send(file);
    });
  }

  /**
   * Step 3: Confirm upload completion
   */
  async confirmUpload(type, fileId, s3Key) {
    const response = await fetch(`${this.apiBaseUrl}/s3/confirm-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        type: type,
        file_id: fileId,
        s3_key: s3Key,
      }),
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to confirm upload');
    }

    return data.data;
  }

  /**
   * Report upload failure
   */
  async reportFailure(type, fileId, errorMessage) {
    try {
      await fetch(`${this.apiBaseUrl}/s3/upload-failed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          type: type,
          file_id: fileId,
          error_message: errorMessage,
        }),
      });
    } catch (err) {
      console.error('Failed to report upload failure:', err);
    }
  }
}

// Usage Example
const uploader = new S3DirectUpload('https://yourapi.com/api', 'your-auth-token');

const fileInput = document.getElementById('file-input');
const progressBar = document.getElementById('progress');
const statusText = document.getElementById('status');

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    statusText.textContent = 'Uploading...';
    
    const result = await uploader.uploadFile(
      file,
      'post',
      'your-post-uuid',
      (percent, loaded, total) => {
        progressBar.value = percent;
        statusText.textContent = `Uploading: ${Math.round(percent)}%`;
      }
    );

    statusText.textContent = 'Upload complete!';
    console.log('File URL:', result.file_url);
    
  } catch (error) {
    statusText.textContent = `Upload failed: ${error.message}`;
    console.error(error);
  }
});
```

### React Example

```jsx
import { useState } from 'react';

function FileUpload({ postId, authToken }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [fileUrl, setFileUrl] = useState(null);

  const uploadFile = async (file) => {
    try {
      setStatus('Getting upload URL...');
      
      // Step 1: Get pre-signed URL
      const presignedResponse = await fetch('/api/s3/generate-presigned-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: 'post',
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          parent_id: postId,
        }),
      });

      const { data: presignedData } = await presignedResponse.json();

      // Step 2: Upload to S3
      setStatus('Uploading to S3...');
      
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress((e.loaded / e.total) * 100);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 204) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));

        xhr.open(presignedData.method, presignedData.upload_url);
        xhr.setRequestHeader('Content-Type', presignedData.headers['Content-Type']);
        xhr.setRequestHeader('x-amz-acl', presignedData.headers['x-amz-acl']);
        xhr.send(file);
      });

      // Step 3: Confirm upload
      setStatus('Confirming upload...');
      
      const confirmResponse = await fetch('/api/s3/confirm-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: 'post',
          file_id: presignedData.file_id,
          s3_key: presignedData.s3_key,
        }),
      });

      const { data: result } = await confirmResponse.json();

      setStatus('Upload complete!');
      setFileUrl(result.file_url);
      
    } catch (error) {
      setStatus(`Upload failed: ${error.message}`);
      console.error(error);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*,video/*"
        onChange={(e) => uploadFile(e.target.files[0])}
      />
      
      {progress > 0 && (
        <div>
          <progress value={progress} max="100" />
          <p>{Math.round(progress)}%</p>
        </div>
      )}
      
      <p>{status}</p>
      
      {fileUrl && (
        <img src={fileUrl} alt="Uploaded" style={{ maxWidth: '200px' }} />
      )}
    </div>
  );
}
```

### Vue.js Example

```vue
<template>
  <div>
    <input type="file" @change="uploadFile" accept="image/*,video/*" />
    
    <div v-if="progress > 0">
      <progress :value="progress" max="100"></progress>
      <p>{{ Math.round(progress) }}%</p>
    </div>
    
    <p>{{ status }}</p>
    
    <img v-if="fileUrl" :src="fileUrl" alt="Uploaded" style="max-width: 200px" />
  </div>
</template>

<script>
export default {
  props: ['postId', 'authToken'],
  
  data() {
    return {
      progress: 0,
      status: '',
      fileUrl: null,
    };
  },
  
  methods: {
    async uploadFile(event) {
      const file = event.target.files[0];
      if (!file) return;

      try {
        this.status = 'Getting upload URL...';
        
        // Get pre-signed URL
        const presignedResponse = await fetch('/api/s3/generate-presigned-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`,
          },
          body: JSON.stringify({
            type: 'post',
            file_name: file.name,
            mime_type: file.type,
            file_size: file.size,
            parent_id: this.postId,
          }),
        });

        const { data: presignedData } = await presignedResponse.json();

        // Upload to S3
        this.status = 'Uploading...';
        await this.uploadToS3(file, presignedData);

        // Confirm upload
        this.status = 'Confirming...';
        const result = await this.confirmUpload(presignedData);

        this.status = 'Complete!';
        this.fileUrl = result.file_url;
        
      } catch (error) {
        this.status = `Failed: ${error.message}`;
      }
    },

    uploadToS3(file, presignedData) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            this.progress = (e.loaded / e.total) * 100;
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 204) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));

        xhr.open(presignedData.method, presignedData.upload_url);
        xhr.setRequestHeader('Content-Type', presignedData.headers['Content-Type']);
        xhr.setRequestHeader('x-amz-acl', presignedData.headers['x-amz-acl']);
        xhr.send(file);
      });
    },

    async confirmUpload(presignedData) {
      const response = await fetch('/api/s3/confirm-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          type: 'post',
          file_id: presignedData.file_id,
          s3_key: presignedData.s3_key,
        }),
      });

      const { data } = await response.json();
      return data;
    },
  },
};
</script>
```

---

## Comparison: Queue vs Direct Upload

| Feature | Queue Upload | Direct Upload |
|---------|-------------|---------------|
| Server load | High | None |
| Upload speed | Slower (2x transfer) | Fast (direct) |
| PHP memory | Required | None |
| Queue delays | Yes (seconds) | No (instant) |
| Progress tracking | No | Yes (real-time) |
| Large files (>100MB) | Difficult | Easy |
| Scalability | Limited | Unlimited |
| User experience | Wait for queue | Immediate |

---

## Security

- Pre-signed URLs expire after 15 minutes
- URLs are single-use (cannot be reused)
- File size is enforced (max 100MB)
- MIME types are validated
- User authentication required

---

## Error Handling

Common errors and solutions:

**403 Forbidden**
- Pre-signed URL expired (>15 minutes)
- Get a new URL and retry

**Network Error**
- Check internet connection
- Retry upload

**File Too Large**
- Reduce file size or compress
- Max: 100MB

---

## Testing

```bash
# Test with cURL
curl -X POST http://yourapi.com/api/s3/generate-presigned-url \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "post",
    "file_name": "test.jpg",
    "mime_type": "image/jpeg",
    "file_size": 1024,
    "parent_id": "test-post-id"
  }'
```

---

## Migration from Queue Upload

Both methods work simultaneously. Migrate gradually:

1. Keep queue upload for legacy apps
2. Use direct upload for new features
3. Update mobile apps first
4. Update web frontend
5. Eventually deprecate queue upload

No changes required to existing code!
