import { getImageUrl } from '@/utility';

// Server-side function to fetch post data for metadata
async function fetchPostData(postId) {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.oldclubman.com';
        console.log('[OG Metadata] Fetching post from:', `${apiUrl}/public/post/${postId}`);

        const response = await fetch(`${apiUrl}/public/post/${postId}`, {
            next: { revalidate: 60 }, // Cache for 60 seconds
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            console.error('[OG Metadata] Failed to fetch post:', response.status, response.statusText);
            return null;
        }

        const data = await response.json();
        console.log('[OG Metadata] API response structure:', JSON.stringify(data, null, 2).substring(0, 500));

        const post = data?.data?.value || data?.data?.post || data?.post || data?.value || data?.data || null;
        console.log('[OG Metadata] Extracted post:', post ? `ID: ${post.id}, Files: ${post.files?.length || 0}` : 'null');

        return post;
    } catch (error) {
        console.error('[OG Metadata] Error fetching post:', error.message);
        return null;
    }
}

// Helper to get the best image URL for OG tag
function getOgImageUrl(post) {
    if (!post) return null;

    const baseUrl = (process.env.NEXT_PUBLIC_FILE_PATH || 'https://d154q69kxu0fuf.cloudfront.net').replace(/\/+$/, '');

    // First, check for post files (images/videos)
    if (post.files && post.files.length > 0) {
        const firstFile = post.files[0];
        const filePath = firstFile.file_path || firstFile.path;

        // Skip if it's a video (no good thumbnail)
        if (filePath && /\.(mp4|webm|ogg|mov|avi)$/i.test(filePath)) {
            // Try background_url as fallback for videos
        } else if (filePath) {
            // Check if it's already a full URL
            if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
                return filePath;
            }

            // Clean the path - remove leading slashes
            const cleanPath = filePath.replace(/^\/+/, '');

            // Check if path already includes 'post/' prefix
            if (cleanPath.startsWith('post/')) {
                return `${baseUrl}/${cleanPath}`;
            }

            // Add 'post/' prefix for post file images
            return `${baseUrl}/post/${cleanPath}`;
        }
    }

    // Check for background URL (text posts with backgrounds)
    if (post.background_url && /\/post_background\/.+/.test(post.background_url)) {
        if (post.background_url.startsWith('http')) {
            return post.background_url;
        }
        const cleanBgPath = post.background_url.replace(/^\/+/, '');
        return `${baseUrl}/${cleanBgPath}`;
    }

    return null;
}

// Helper to strip HTML tags from message
function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '').trim();
}

// Generate dynamic metadata for the post page
export async function generateMetadata({ params }) {
    const postId = params.id;
    const post = await fetchPostData(postId);

    // Default metadata if post not found
    if (!post) {
        return {
            title: 'Post | OLD CLUB MAN',
            description: 'View this post on OLD CLUB MAN - Network, Community',
        };
    }

    // Get author name
    const authorName = post.client?.display_name ||
        `${post.client?.fname || ''} ${post.client?.last_name || ''}`.trim() ||
        'Someone';

    // Get post description (strip HTML and limit length)
    const rawMessage = stripHtml(post.message);
    const description = rawMessage
        ? rawMessage.substring(0, 200) + (rawMessage.length > 200 ? '...' : '')
        : `${authorName} shared a post on OLD CLUB MAN`;

    // Get the OG image URL
    const ogImageUrl = getOgImageUrl(post);

    // Construct the canonical URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://oldclubman.com';
    const postUrl = `${siteUrl}/post/${postId}`;

    // Build metadata object
    const metadata = {
        title: `${authorName}'s post | OLD CLUB MAN`,
        description: description,

        // Open Graph tags for Facebook
        openGraph: {
            title: `${authorName}'s post on OLD CLUB MAN`,
            description: description,
            url: postUrl,
            siteName: 'OLD CLUB MAN',
            type: 'article',
            locale: 'en_US',
            ...(ogImageUrl && {
                images: [
                    {
                        url: ogImageUrl,
                        width: 1200,
                        height: 630,
                        alt: `Post by ${authorName}`,
                    },
                ],
            }),
            article: {
                publishedTime: post.created_at,
                authors: [authorName],
            },
        },

        // Twitter Card tags
        twitter: {
            card: ogImageUrl ? 'summary_large_image' : 'summary',
            title: `${authorName}'s post`,
            description: description,
            ...(ogImageUrl && { images: [ogImageUrl] }),
        },

        // Other important meta tags
        alternates: {
            canonical: postUrl,
        },
    };

    return metadata;
}

// Layout component that wraps the post page
export default function PostLayout({ children }) {
    return children;
}
