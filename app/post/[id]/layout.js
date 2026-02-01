import { getImageUrl } from '@/utility';

// Server-side function to fetch post data for metadata
async function fetchPostData(postId) {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.oldclubman.com';
        const response = await fetch(`${apiUrl}/public/post/${postId}`, {
            next: { revalidate: 60 }, // Cache for 60 seconds
        });

        if (!response.ok) {
            console.error('Failed to fetch post for metadata:', response.status);
            return null;
        }

        const data = await response.json();
        return data?.data?.value || data?.data?.post || data?.post || data?.value || null;
    } catch (error) {
        console.error('Error fetching post for metadata:', error);
        return null;
    }
}

// Helper to get the best image URL for OG tag
function getOgImageUrl(post) {
    if (!post) return null;

    // First, check for post files (images/videos)
    if (post.files && post.files.length > 0) {
        const firstFile = post.files[0];
        const filePath = firstFile.file_path || firstFile.path;

        // If it's a video, we might not have a good thumbnail
        // For images, construct the full URL
        if (filePath) {
            // Check if it's already a full URL
            if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
                return filePath;
            }
            // Use the file path with the CDN/storage URL
            const baseUrl = process.env.NEXT_PUBLIC_FILE_PATH || 'https://d154q69kxu0fuf.cloudfront.net/';
            return `${baseUrl}${filePath}`;
        }
    }

    // Check for background URL (text posts with backgrounds)
    if (post.background_url && /\/post_background\/.+/.test(post.background_url)) {
        if (post.background_url.startsWith('http')) {
            return post.background_url;
        }
        const baseUrl = process.env.NEXT_PUBLIC_FILE_PATH || 'https://d154q69kxu0fuf.cloudfront.net/';
        return `${baseUrl}${post.background_url}`;
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
