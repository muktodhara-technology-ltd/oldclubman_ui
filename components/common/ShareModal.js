'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaTimes, FaLink, FaGlobeAmericas } from 'react-icons/fa';
import { IoLogoWhatsapp } from 'react-icons/io';
import toast from 'react-hot-toast';
import { sharePost } from '@/views/gathering/store';

/**
 * ShareModal - Reusable share modal component
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to close the modal
 * @param {number|string} postId - ID of the post to share
 * @param {function} onShareSuccess - Optional callback after successful share
 */
const ShareModal = ({ isOpen, onClose, postId, onShareSuccess }) => {
    const dispatch = useDispatch();
    const profile = useSelector((state) => state.profile?.profile);
    const [shareMessage, setShareMessage] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    const getClientImageUrl = (imagePath) => {
        if (!imagePath) return "/common-avator.jpg";
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }
        return process.env.NEXT_PUBLIC_FILE_PATH + imagePath;
    };

    const handleConfirmShare = () => {
        if (!postId || isSharing) return;
        setIsSharing(true);
        dispatch(sharePost({ post_id: postId, content: shareMessage }))
            .then(() => {
                toast.success("Shared Successfully");
                setShareMessage('');
                onClose();
                if (onShareSuccess) onShareSuccess();
            })
            .catch((err) => {
                console.error('Share failed:', err);
                toast.error("Failed to share");
            })
            .finally(() => {
                setIsSharing(false);
            });
    };

    const handleCancel = () => {
        setShareMessage('');
        setIsSharing(false);
        onClose();
    };

    const getPostUrl = () => {
        if (typeof window !== 'undefined') {
            return `${window.location.origin}/post/${postId}`;
        }
        return '';
    };

    const handleWhatsAppShare = () => {
        const postUrl = getPostUrl();
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(postUrl)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleFacebookShare = () => {
        const postUrl = getPostUrl();
        const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
        window.open(facebookShareUrl, '_blank', 'width=600,height=400');
    };

    const handleCopyLink = async () => {
        const postUrl = getPostUrl();
        try {
            await navigator.clipboard.writeText(postUrl);
            toast.success('Link copied!');
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = postUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast.success('Link copied!');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl w-full max-w-[500px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="relative border-b border-gray-200 px-4 py-4 flex items-center justify-center shrink-0">
                    <h3 className="text-xl font-bold text-gray-900">Share</h3>
                    <button
                        onClick={handleCancel}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
                    >
                        <FaTimes className="text-gray-600 text-lg" />
                    </button>
                </div>

                <div className="overflow-y-auto custom-scrollbar">
                    <div className="p-4">
                        {/* Profile Section */}
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-100 shrink-0">
                                <img
                                    src={getClientImageUrl(profile?.client?.image)}
                                    alt={profile?.client?.display_name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.src = "/common-avator.jpg"; }}
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-gray-900 text-[17px]">
                                    {profile?.client?.display_name || profile?.client?.fname}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded font-semibold">Feed</span>
                                    <div className="flex items-center gap-1 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded font-semibold">
                                        <FaGlobeAmericas className="text-[10px]" />
                                        <span>Public</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="mb-4">
                            <textarea
                                placeholder="Say something about this..."
                                className="w-full text-lg placeholder-gray-500 border-none focus:ring-0 focus:outline-none resize-none min-h-[80px] p-0"
                                value={shareMessage}
                                onChange={(e) => setShareMessage(e.target.value)}
                            />
                            <div className="flex justify-between items-center mt-2">
                                <div>{/* Placeholder for future emoji button */}</div>
                                <button
                                    onClick={handleConfirmShare}
                                    disabled={isSharing}
                                    className={`px-8 py-2 rounded-lg font-semibold text-white text-[15px] transition-colors ${isSharing ? 'bg-blue-400 cursor-not-allowed' : 'bg-[#0866FF] hover:bg-blue-700'}`}
                                >
                                    {isSharing ? 'Sharing...' : 'Share now'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-200"></div>

                    {/* Share to */}
                    <div className="p-4 pt-4">
                        <h4 className="font-semibold text-gray-900 mb-4 text-[17px]">Share to</h4>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">

                            {/* WhatsApp */}
                            <button
                                onClick={handleWhatsAppShare}
                                className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group"
                            >
                                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                                    <IoLogoWhatsapp className="text-2xl text-black" />
                                </div>
                                <span className="text-xs text-gray-600 font-medium">WhatsApp</span>
                            </button>

                            {/* Facebook */}
                            <button
                                onClick={handleFacebookShare}
                                className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group"
                            >
                                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                                    <span className="font-bold text-xl text-blue-600">f</span>
                                </div>
                                <span className="text-xs text-gray-600 font-medium">Facebook</span>
                            </button>

                            {/* Copy Link */}
                            <button
                                onClick={handleCopyLink}
                                className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group"
                            >
                                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                                    <FaLink className="text-2xl text-black" />
                                </div>
                                <span className="text-xs text-gray-600 font-medium">Copy link</span>
                            </button>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
