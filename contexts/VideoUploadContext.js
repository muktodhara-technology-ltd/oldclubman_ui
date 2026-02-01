"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { getGathering, getPosts } from '@/views/gathering/store';
import { getMyProfile } from '@/views/settings/store';

const VideoUploadContext = createContext(null);

export const useVideoUpload = () => {
    const context = useContext(VideoUploadContext);
    if (!context) {
        throw new Error('useVideoUpload must be used within VideoUploadProvider');
    }
    return context;
};

export const VideoUploadProvider = ({ children }) => {
    const dispatch = useDispatch();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: string }
    const abortControllerRef = useRef(null);

    const clearNotification = useCallback(() => {
        setNotification(null);
    }, []);

    const uploadVideoToS3 = async (presignedData, file, onProgress) => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = (e.loaded / e.total) * 100;
                    onProgress(percent);
                }
            };

            xhr.onload = async () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Network error during S3 upload'));
            xhr.onabort = () => reject(new Error('Upload cancelled'));

            xhr.open(presignedData.method, presignedData.upload_url);

            // Set headers from presigned data
            if (presignedData.headers) {
                Object.entries(presignedData.headers).forEach(([key, value]) => {
                    xhr.setRequestHeader(key, value);
                });
            }

            xhr.send(file);

            // Connect abort signal
            if (abortControllerRef.current) {
                abortControllerRef.current.signal.addEventListener('abort', () => xhr.abort());
            }
        });
    };

    const confirmUpload = async (fileId, s3Key) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('old_token') : null;
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/s3/confirm-upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                type: 'post',
                file_id: fileId,
                s3_key: s3Key
            })
        });

        if (!response.ok) {
            throw new Error('Failed to confirm upload');
        }
    };

    const uploadMultipartVideoToS3 = async (presignedData, file, onProgress) => {
        const { upload_id, s3_key, num_parts, part_size, mime_type } = presignedData;
        const totalSize = file.size;
        let uploadedParts = [];
        const token = typeof window !== 'undefined' ? localStorage.getItem('old_token') : null;

        for (let partNumber = 1; partNumber <= num_parts; partNumber++) {
            // Check for cancellation
            if (abortControllerRef.current && abortControllerRef.current.signal.aborted) {
                throw new Error('Upload cancelled');
            }

            const start = (partNumber - 1) * part_size;
            const end = Math.min(start + part_size, totalSize);
            const chunk = file.slice(start, end);

            // Get presigned URL for this part
            const partUrlResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/s3/multipart/part-url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    s3_key: s3_key,
                    upload_id: upload_id,
                    part_number: partNumber
                })
            });

            if (!partUrlResponse.ok) {
                throw new Error(`Failed to get presigned URL for part ${partNumber}`);
            }

            const { part_url } = await partUrlResponse.json();

            // Upload the part
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.onprogress = (e) => {
                    // Since we do one part at a time, we can calculate total progress here roughly
                    // but simpler to just track finished parts in the outer loop or do part-based progress
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        // ETag is needed for completion
                        const eTag = xhr.getResponseHeader('ETag');
                        resolve({ ETag: eTag, PartNumber: partNumber });
                    } else {
                        reject(new Error(`Part upload failed: ${xhr.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error('Network error during part upload'));
                xhr.open('PUT', part_url);
                xhr.send(chunk);

                // Connect abort signal
                if (abortControllerRef.current) {
                    abortControllerRef.current.signal.addEventListener('abort', () => xhr.abort());
                }
            }).then(partData => {
                uploadedParts.push(partData);
                const percent = (partNumber / num_parts) * 100;
                onProgress(percent);
            });
        }

        // Complete multipart upload
        const completeResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/s3/multipart/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                s3_key: s3_key,
                upload_id: upload_id,
                parts: uploadedParts
            })
        });

        if (!completeResponse.ok) {
            throw new Error('Failed to complete multipart upload');
        }
    };

    const startUpload = useCallback(async (formData, postId = null, originalFiles = []) => {
        setIsUploading(true);
        setUploadProgress(0);
        setNotification({ type: 'info', message: 'Starting upload...' });

        // Create abort controller for potential cancellation
        abortControllerRef.current = new AbortController();

        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('old_token') : null;
            const baseUrl = process.env.NEXT_PUBLIC_API_URL;

            const url = postId
                ? `${baseUrl}/post/update/${postId}`
                : `${baseUrl}/post/store`;

            // Step 1: Initial Post Creation / Update
            // Images are uploaded here directly. Video placeholders are created.
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                throw new Error('Initial upload failed');
            }

            const result = await response.json();

            // Check for videos that need direct S3 upload
            if (result.data && result.data.presigned_videos && result.data.presigned_videos.length > 0) {
                const presignedVideos = result.data.presigned_videos;
                const totalVideos = presignedVideos.length;

                // Identify video files from originalFiles
                const videoFiles = Array.from(originalFiles).filter(f => f.type.startsWith('video/'));

                for (let i = 0; i < totalVideos; i++) {
                    const presignedData = presignedVideos[i];
                    // Match by name ideally, but fallback to index
                    // Backend returns `file_name` in presignedData which matches `name` in metadata/file
                    const videoFile = videoFiles.find(f => f.name === presignedData.file_name) || videoFiles[i];

                    if (!videoFile) {
                        console.warn(`Could not find video file for index ${i}`);
                        continue;
                    }

                    setNotification({ type: 'info', message: `Uploading video ${i + 1} of ${totalVideos}...` });

                    // Upload to S3
                    if (presignedData.upload_method === 'multipart') {
                        await uploadMultipartVideoToS3(presignedData, videoFile, (percent) => {
                            const globalProgress = ((i * 100) + percent) / totalVideos;
                            setUploadProgress(globalProgress);
                        });
                    } else if (presignedData.upload_url) {
                        await uploadVideoToS3(presignedData, videoFile, (percent) => {
                            const globalProgress = ((i * 100) + percent) / totalVideos;
                            setUploadProgress(globalProgress);
                        });

                        // Confirm Upload (only for non-multipart)
                        await confirmUpload(presignedData.file_id, presignedData.s3_key);
                    } else {
                        console.error('Missing upload configuration:', presignedData);
                        throw new Error('Server returned invalid upload configuration');
                    }
                }
            }

            // All done
            setIsUploading(false);
            setUploadProgress(100);
            setNotification({ type: 'success', message: 'Post uploaded successfully!' });

            // Refresh posts
            dispatch(getGathering());
            dispatch(getPosts());
            dispatch(getMyProfile());

            // Auto-dismiss notification after 4 seconds
            setTimeout(() => {
                setNotification(null);
            }, 4000);

            return result;
        } catch (error) {
            console.error('Video upload error:', error);
            setIsUploading(false);

            if (error.name === 'AbortError') {
                setNotification({ type: 'info', message: 'Upload cancelled' });
            } else {
                setNotification({ type: 'error', message: 'Failed to upload post. Please try again.' });
            }

            // Auto-dismiss error notification after 5 seconds
            setTimeout(() => {
                setNotification(null);
            }, 5000);

            throw error;
        }
    }, [dispatch]);

    const cancelUpload = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsUploading(false);
        setUploadProgress(0);
        setNotification({ type: 'info', message: 'Upload cancelled' });
    }, []);

    const value = {
        isUploading,
        uploadProgress,
        notification,
        startUpload,
        cancelUpload,
        clearNotification,
    };

    return (
        <VideoUploadContext.Provider value={value}>
            {children}
        </VideoUploadContext.Provider>
    );
};

export default VideoUploadContext;
