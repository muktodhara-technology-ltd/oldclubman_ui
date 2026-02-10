"use client";

import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { getPostById } from '@/views/gathering/store';
import Link from 'next/link';

const ChatPostPreview = ({ postId }) => {
    const dispatch = useDispatch();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;

        console.log('ChatPostPreview mounted with postId:', postId);

        if (postId) {
            setLoading(true);
            dispatch(getPostById(postId))
                .unwrap()
                .then((data) => {
                    console.log('ChatPostPreview fetch success:', data);
                    if (isMounted) {
                        setPost(data);
                        setLoading(false);
                    }
                })
                .catch((err) => {
                    console.error("Failed to fetch post preview:", err);
                    if (isMounted) {
                        setError(true);
                        setLoading(false);
                    }
                });
        }

        return () => {
            isMounted = false;
        };
    }, [postId, dispatch]);

    // Helper to construct file URL (copied from ChatBox.js for consistency)
    const getFileUrl = (filePath) => {
        if (!filePath) return null;

        // If it's already a full URL (http:// or https://), return as-is
        if (/^https?:\/\//i.test(filePath)) {
            return filePath;
        }

        // Clean up malformed paths that start with domain name or dots
        let cleanPath = filePath;

        // Remove leading dots and domain names (e.g., ".oldclubman.com/" or "oldclubman.com/")
        cleanPath = cleanPath.replace(/^\.?[a-zA-Z0-9.-]+\.(com|net|org|io)(\/|$)/i, '');

        // Remove leading /api/ if present
        cleanPath = cleanPath.replace(/^\/api\//, '');

        // Remove leading slashes
        cleanPath = cleanPath.replace(/^\/+/, '');

        // Get base URL without /api suffix and remove trailing slashes
        const apiUrl = (process.env.NEXT_PUBLIC_FILE_PATH || '').replace(/\/+$/, '');

        // Construct final URL
        const fullUrl = `${apiUrl}/${cleanPath}`;

        return fullUrl;
    };

    if (loading) return <div className="p-2 text-xs text-gray-500 bg-gray-100 rounded animate-pulse">Loading preview...</div>;
    if (error || !post) return null; // Hide if error or not found

    // Parse files to find first image/video
    let previewImage = null;
    let previewVideo = null;

    if (post.files && post.files.length > 0) {
        const file = post.files[0];
        console.log('ChatPostPreview file:', file);

        if (file.file_type === 'image' || file.type?.startsWith('image')) {
            previewImage = getFileUrl(file.path || file.file_path);
            console.log('ChatPostPreview image url:', previewImage);
        } else if (file.file_type === 'video' || file.type?.startsWith('video')) {
            previewVideo = getFileUrl(file.path || file.file_path);
            console.log('ChatPostPreview video url:', previewVideo);
        }
    }

    // Fallback for text content
    // Fallback for text content
    const rawText = post.description || post.message || "Shared a post";
    // Strip HTML tags
    const previewText = rawText.replace(/<[^>]*>?/gm, '');
    const truncatedText = previewText.length > 60 ? previewText.substring(0, 60) + '...' : previewText;

    return (
        <div className="mt-2 mb-1 max-w-sm w-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="block no-underline">
                {previewImage && (
                    <Link href={`/post/${postId}`} target="_blank" className="block h-32 w-full overflow-hidden bg-gray-100">
                        <img
                            src={previewImage}
                            alt="Post preview"
                            className="w-full h-full object-cover"
                            onError={(e) => e.target.style.display = 'none'}
                        />
                    </Link>
                )}
                {previewVideo && (
                    <div className="h-48 w-full bg-black">
                        <video
                            src={previewVideo}
                            controls
                            className="w-full h-full object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}
                <Link href={`/post/${postId}`} target="_blank" className="block p-3">
                    <p className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">{truncatedText}</p>
                    <div className="flex items-center text-xs text-blue-500">
                        <span>View Post</span>
                        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </div>
                </Link>
            </div>
        </div>
    );
};

export default ChatPostPreview;
