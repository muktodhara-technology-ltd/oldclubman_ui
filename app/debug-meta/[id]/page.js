import React from 'react';
import Link from 'next/link';

// --- Duplicate Logic from app/post/[id]/layout.js for Authenticity ---

async function fetchPostData(postId) {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.oldclubman.com';
        const response = await fetch(`${apiUrl}/public/post/${postId}`, {
            next: { revalidate: 60 },
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) return { error: `API Error: ${response.status} ${response.statusText}` };

        const data = await response.json();
        const post = data?.data?.value || data?.data?.post || data?.post || data?.value || data?.data || null;
        return post || { error: 'Post not found in response structure', raw: data };
    } catch (error) {
        return { error: error.message };
    }
}

function getOgVideoUrl(post) {
    if (!post || post.error) return null;
    const baseUrl = (process.env.NEXT_PUBLIC_FILE_PATH || 'https://d154q69kxu0fuf.cloudfront.net').replace(/\/+$/, '');

    if (post.files && post.files.length > 0) {
        const firstFile = post.files[0];
        const filePath = firstFile.file_path || firstFile.path;

        if (filePath && /\.(mp4|webm|ogg|mov|avi)$/i.test(filePath)) {
            if (filePath.startsWith('http')) return filePath;
            const cleanPath = filePath.replace(/^\/+/, '');
            if (cleanPath.startsWith('post/')) return `${baseUrl}/${cleanPath}`;
            return `${baseUrl}/post/${cleanPath}`;
        }
    }
    return null;
}

function getOgImageUrl(post) {
    if (!post || post.error) return null;
    const baseUrl = (process.env.NEXT_PUBLIC_FILE_PATH || 'https://d154q69kxu0fuf.cloudfront.net').replace(/\/+$/, '');
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://oldclubman.com';

    if (post.files && post.files.length > 0) {
        const firstFile = post.files[0];
        const filePath = firstFile.file_path || firstFile.path;

        if (filePath && /\.(mp4|webm|ogg|mov|avi)$/i.test(filePath)) {
            // Video file - skip here
        } else if (filePath) {
            if (filePath.startsWith('http')) return filePath;
            const cleanPath = filePath.replace(/^\/+/, '');
            if (cleanPath.startsWith('post/')) return `${baseUrl}/${cleanPath}`;
            return `${baseUrl}/post/${cleanPath}`;
        }
    }

    if (post.background_url && /\/post_background\/.+/.test(post.background_url)) {
        if (post.background_url.startsWith('http')) return post.background_url;
        const cleanBgPath = post.background_url.replace(/^\/+/, '');
        return `${baseUrl}/${cleanBgPath}`;
    }

    return `${siteUrl}/oldman-logo.png`;
}

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '').trim();
}

// --- Debug Page Component ---

export default async function DebugMetaPage({ params }) {
    const postId = params.id;
    const post = await fetchPostData(postId);

    // Calculate values
    const ogVideoUrl = getOgVideoUrl(post);
    const ogImageUrl = getOgImageUrl(post);

    const authorName = post.client?.display_name ||
        `${post.client?.fname || ''} ${post.client?.last_name || ''}`.trim() ||
        'Someone';

    const rawMessage = stripHtml(post?.message);
    const description = rawMessage
        ? rawMessage.substring(0, 200) + (rawMessage.length > 200 ? '...' : '')
        : `${authorName} shared a post on OLD CLUB MAN`;

    const envDebug = {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_FILE_PATH: process.env.NEXT_PUBLIC_FILE_PATH,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    };

    return (
        <div className="p-10 max-w-4xl mx-auto font-mono text-sm">
            <h1 className="text-2xl font-bold mb-6 text-red-600">OG Metadata Debugger</h1>

            <Link href={`/post/${postId}`} className="text-blue-600 hover:underline mb-8 block">
                &larr; Back to Post
            </Link>

            <div className="space-y-8">
                <section className="bg-gray-100 p-4 rounded border">
                    <h2 className="font-bold text-lg mb-2">Calculated Meta Tags</h2>
                    <div className="grid grid-cols-[150px_1fr] gap-2">
                        <div className="font-bold">og:title</div>
                        <div>{`${authorName}'s post | OLD CLUB MAN`}</div>

                        <div className="font-bold">og:description</div>
                        <div>{description}</div>

                        <div className={`font-bold ${ogVideoUrl ? 'text-green-600' : 'text-gray-500'}`}>og:video</div>
                        <div className={ogVideoUrl ? 'text-green-700 font-bold' : 'text-gray-400'}>
                            {ogVideoUrl || 'NULL (No video detected)'}
                        </div>

                        <div className="font-bold">og:image</div>
                        <div>
                            {ogImageUrl ? (
                                <div className="flex flex-col gap-2">
                                    <span>{ogImageUrl}</span>
                                    <img src={ogImageUrl} alt="Preview" className="h-20 w-auto object-contain bg-white border" />
                                </div>
                            ) : 'NULL'}
                        </div>

                        <div className="font-bold">og:type</div>
                        <div>{ogVideoUrl ? 'video.other' : 'article'}</div>

                        <div className="font-bold">twitter:card</div>
                        <div>{ogVideoUrl ? 'player' : 'summary_large_image'}</div>
                    </div>
                </section>

                <section className="bg-yellow-50 p-4 rounded border border-yellow-200">
                    <h2 className="font-bold text-lg mb-2">Environment Variables</h2>
                    <pre>{JSON.stringify(envDebug, null, 2)}</pre>
                </section>

                <section className="bg-blue-50 p-4 rounded border border-blue-200">
                    <h2 className="font-bold text-lg mb-2">Raw Post Data (from API)</h2>
                    <pre className="overflow-auto max-h-96">{JSON.stringify(post, null, 2)}</pre>
                </section>
            </div>
        </div>
    );
}
