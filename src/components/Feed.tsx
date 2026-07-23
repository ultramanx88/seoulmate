import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest, parseApiDate } from '../lib/api';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Flag, Heart, MessageSquare, Send, Globe, Sparkles, Wand2, UserCheck, Star, Share2, LockKeyhole, SmilePlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { geminiService } from '../services/gemini';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { basicStickers, getBasicSticker, getStickerLabel, type BasicSticker } from '../data/basic-stickers';

export default function Feed({ translationTarget }: { translationTarget: 'TH' | 'KR' }) {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedTopic, setEnhancedTopic] = useState<{ title: string; description: string; intent: string } | null>(null);
  const [matchingResults, setMatchingResults] = useState<any[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [selectedPostForMatch, setSelectedPostForMatch] = useState<any | null>(null);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [translations, setTranslations] = useState<Record<string, { text: string; lang: string }>>({});
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  
  const [selectedPostForComments, setSelectedPostForComments] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [discussionStickerTrayOpen, setDiscussionStickerTrayOpen] = useState(false);
  const [discussionStickerLocale, setDiscussionStickerLocale] = useState<'TH' | 'KR'>(translationTarget);
  const [replySuggestions, setReplySuggestions] = useState<{ style: string; text: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const discussionBottomRef = useRef<HTMLDivElement>(null);
  const canUseDiscussionStickers = profile?.plan === 'pro' || profile?.plan === 'pro_unlimited';

  useEffect(() => {
    setDiscussionStickerLocale(translationTarget);
  }, [translationTarget]);

  const fetchRankedFeed = async () => {
    setLoading(true);
    try {
      const result = await apiRequest<{ topics: any[] }>('/v1/topics');
      setPosts(result.topics);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load community topics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchRankedFeed();
    }
  }, [profile]);

  const handleEnhance = async () => {
    if (!newPost.trim()) return;
    setIsEnhancing(true);
    try {
      const result = await geminiService.rewriteTopic(newPost, profile);
      setEnhancedTopic(result);
    } catch (e) {
      toast.error("AI enhancement failed");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handlePost = async (topicData?: { title: string; description: string; intent: string }) => {
    const postContent = topicData ? topicData.description : newPost;
    const postTitle = topicData ? topicData.title : "";
    let postIntent = topicData ? topicData.intent : "";

    if (!postContent.trim()) return;
    setSubmitting(true);
    try {
      // Safety Check
      const safety = await geminiService.checkTopicSafety(postContent, profile);
      if (safety.status !== 'normal') {
        toast.error(`Moment blocked: ${safety.status}`, {
            description: safety.reasons.join('. ')
        });
        return;
      }

      // Auto-classify if not already done via AI Polish
      if (!postIntent) {
        postIntent = await geminiService.classifyTopic(postContent);
      }

      const result = await apiRequest<{ topic: any }>('/v1/topics', {
        method: 'POST',
        body: JSON.stringify({
        title: postTitle,
        content: postContent,
        intent: postIntent,
        }),
      });
      setPosts((previous) => [result.topic, ...previous]);
      setNewPost('');
      setEnhancedTopic(null);
      toast.success("Moment shared!");
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'USAGE_LIMIT_REACHED'
        ? 'Daily posting limit reached. Pro will raise this limit.'
        : 'Failed to share moment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const result = await apiRequest<{ likesCount: number }>(`/v1/topics/${postId}/like`, {
        method: 'POST',
      });
      setPosts((previous) =>
        previous.map((post) => (post.id === postId ? { ...post, likesCount: result.likesCount } : post))
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to like moment");
    }
  };

  const reportPost = async (post: any) => {
    setReportTarget(post);
    setReportReason('');
  };

  const submitPostReport = async () => {
    if (!reportTarget || !reportReason.trim()) return;
    try {
      await apiRequest('/v1/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'topic',
          targetId: reportTarget.id,
          reportedUserId: reportTarget.authorId,
          reason: reportReason.trim(),
        }),
      });
      toast.success('Report sent to safety review');
      setReportTarget(null);
      setReportReason('');
    } catch {
      toast.error('Could not submit report');
    }
  };

  const showMatchRecommendations = async (post: any) => {
    setSelectedPostForMatch(post);
    setIsMatching(true);
    setMatchingResults([]);
    try {
      const targetNationality = post.authorNationality === 'TH' ? 'KR' : 'TH';
      const result = await apiRequest<{ users: any[] }>(`/v1/users/match-candidates?nationality=${targetNationality}`);
      const potentialUsers = result.users;
      
      const results = await Promise.all(potentialUsers.map(async (u) => {
        const matchRes = await geminiService.calculateMatchScore(post, u);
        return { user: u, ...matchRes };
      }));

      setMatchingResults(results.sort((a, b) => b.score - a.score));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'USAGE_LIMIT_REACHED'
        ? 'Daily discovery limit reached. Pro will raise this limit.'
        : 'Match analysis failed');
    } finally {
      setIsMatching(false);
    }
  };

  const handleInvite = async (user: any, post: any) => {
    setInvitingUserId(user.id);
    try {
      const invitation = await geminiService.generateInvitation(post, user);
      const chatResult = await apiRequest<{ chat: any }>('/v1/chats', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id }),
      });
      await apiRequest(`/v1/chats/${chatResult.chat.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: invitation }),
      });
      toast.success(`Invitation sent to ${user.displayName}`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'USAGE_LIMIT_REACHED'
        ? 'Daily new chat limit reached. Pro will raise this limit.'
        : 'Failed to send invitation');
    } finally {
      setInvitingUserId(null);
    }
  };

  const handleTranslate = async (postId: string, content: string) => {
    if (translations[postId]) {
      // Toggle off if already translated
      const newTranslations = { ...translations };
      delete newTranslations[postId];
      setTranslations(newTranslations);
      return;
    }

    setIsTranslating(postId);
    try {
      const targetLang = translationTarget;
      await apiRequest('/v1/me/usage/ai_translations_daily/consume', { method: 'POST' });
      const translated = await geminiService.translatePost(content, targetLang as any);
      setTranslations(prev => ({
        ...prev,
        [postId]: { text: translated, lang: targetLang }
      }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'USAGE_LIMIT_REACHED'
        ? 'Translation limit reached. Pro will raise this limit.'
        : 'Translation failed');
    } finally {
      setIsTranslating(null);
    }
  };

  const fetchDiscussion = async (post: any, options: { silent?: boolean; scroll?: boolean } = {}) => {
    if (!options.silent) setLoadingComments(true);
    try {
      const result = await apiRequest<{ comments: any[]; commentsCount?: number }>(`/v1/topics/${post.id}/comments`);
      setComments(result.comments);
      if (typeof result.commentsCount === 'number') {
        setPosts((previous) =>
          previous.map((item) =>
            item.id === post.id ? { ...item, commentsCount: result.commentsCount } : item
          )
        );
        setSelectedPostForComments((current: any | null) =>
          current?.id === post.id ? { ...current, commentsCount: result.commentsCount } : current
        );
      }
      if (options.scroll) {
        setTimeout(() => discussionBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      }
    } catch (error) {
      console.error(error);
      if (!options.silent) toast.error("Failed to load discussion");
    } finally {
      if (!options.silent) setLoadingComments(false);
    }
  };

  const openComments = async (post: any) => {
    setSelectedPostForComments(post);
    setComments([]);
    setNewComment('');
    setDiscussionStickerTrayOpen(false);
    setReplySuggestions([]);

    await fetchDiscussion(post, { scroll: true });

    // AI Suggestions
    setLoadingSuggestions(true);
    try {
        const suggestions = await geminiService.getReplySuggestions(post, profile);
        setReplySuggestions(suggestions);
    } catch (e) {
        console.error(e);
    } finally {
        setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (!selectedPostForComments) return;
    const timer = window.setInterval(() => {
      fetchDiscussion(selectedPostForComments, { silent: true }).catch(console.error);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [selectedPostForComments?.id]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !selectedPostForComments) return;
    const text = newComment.trim();
    setSendingComment(true);
    try {
        const result = await apiRequest<{ comment: any; commentsCount?: number }>(`/v1/topics/${selectedPostForComments.id}/comments`, {
          method: 'POST',
          body: JSON.stringify({ text }),
        });
        setComments((previous) => [...previous, result.comment]);
        setPosts((previous) =>
          previous.map((post) =>
            post.id === selectedPostForComments.id
              ? { ...post, commentsCount: result.commentsCount ?? (post.commentsCount || 0) + 1 }
              : post
          )
        );
        setSelectedPostForComments((current: any | null) =>
          current ? { ...current, commentsCount: result.commentsCount ?? (current.commentsCount || 0) + 1 } : current
        );
        setNewComment('');
        setTimeout(() => discussionBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch (e) {
        toast.error(e instanceof Error && e.message === 'TEXT_TOO_LONG'
          ? 'Message is too long for this discussion.'
          : 'Failed to post reply');
    } finally {
        setSendingComment(false);
    }
  };

  const stickerToneClass = (tone: BasicSticker['tone']) => {
    switch (tone) {
      case 'coral':
        return 'border-brand-coral/20 bg-brand-blush text-brand-coral';
      case 'mint':
        return 'border-brand-mint/30 bg-accent text-accent-foreground';
      case 'lilac':
        return 'border-brand-ink/10 bg-brand-lilac text-brand-ink';
      case 'honey':
        return 'border-brand-honey/30 bg-amber-50 text-amber-700';
      case 'ink':
      default:
        return 'border-brand-ink/10 bg-white text-brand-ink';
    }
  };

  const renderDiscussionSticker = (stickerId: string | null | undefined, fallbackText: string, isMe: boolean) => {
    const sticker = getBasicSticker(stickerId);
    if (!sticker) return <span>{fallbackText}</span>;

    return (
      <div className={`min-w-32 rounded-2xl border p-4 text-center shadow-sm ${stickerToneClass(sticker.tone)} ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
        <div className="text-4xl leading-none">{sticker.emoji}</div>
        <div className="mt-3 text-sm font-black leading-5">{getStickerLabel(sticker, discussionStickerLocale)}</div>
      </div>
    );
  };

  const sendDiscussionSticker = async (sticker: BasicSticker) => {
    if (!selectedPostForComments) return;
    if (!canUseDiscussionStickers) {
      toast.error('Discussion stickers are a Pro feature');
      return;
    }

    setSendingComment(true);
    try {
      const result = await apiRequest<{ comment: any; commentsCount?: number }>(`/v1/topics/${selectedPostForComments.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          stickerId: sticker.id,
          text: getStickerLabel(sticker, discussionStickerLocale),
        }),
      });
      setComments((previous) => [...previous, result.comment]);
      setPosts((previous) =>
        previous.map((post) =>
          post.id === selectedPostForComments.id
            ? { ...post, commentsCount: result.commentsCount ?? (post.commentsCount || 0) + 1 }
            : post
        )
      );
      setSelectedPostForComments((current: any | null) =>
        current ? { ...current, commentsCount: result.commentsCount ?? (current.commentsCount || 0) + 1 } : current
      );
      setDiscussionStickerTrayOpen(false);
      setTimeout(() => discussionBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'FEATURE_REQUIRES_PRO'
        ? 'Discussion stickers are a Pro feature'
        : 'Failed to send sticker');
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex gap-4 mb-4">
            <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                <AvatarImage src={profile?.photoURL} />
                <AvatarFallback>{profile?.displayName?.[0]}</AvatarFallback>
            </Avatar>
            <Textarea 
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Share a moment, question, or plan..."
                className="min-h-[80px] resize-none border-none bg-transparent p-0 text-base font-medium leading-7 placeholder:text-muted-foreground/55 focus-visible:ring-0"
            />
        </div>
        <div className="flex justify-end gap-2">
            <Button 
                onClick={handleEnhance}
                disabled={isEnhancing || !newPost.trim()}
                variant="outline"
                className="h-11 rounded-xl border-border px-4 font-semibold text-brand-ink hover:bg-muted"
            >
                {isEnhancing ? "Refining..." : <><Wand2 className="w-4 h-4 mr-2" /> AI Polish</>}
            </Button>
            <Button 
                onClick={() => handlePost()} 
                disabled={submitting || !newPost.trim()}
                className="action-primary h-11 rounded-xl px-5 font-extrabold"
            >
                <Send className="w-5 h-5 mr-3" /> Share Moment
            </Button>
        </div>
      </div>

      <Dialog open={!!enhancedTopic} onOpenChange={() => setEnhancedTopic(null)}>
        <DialogContent className="mx-auto max-w-sm rounded-2xl border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold text-brand-ink">
                <Sparkles className="w-6 h-6 text-amber-500" /> AI Refined Moment
            </DialogTitle>
          </DialogHeader>
          {enhancedTopic && (
              <div className="space-y-4 py-4">
                <div className="rounded-2xl border border-brand-coral/15 bg-brand-blush p-5 shadow-sm">
                    <div className="mb-2 text-xs font-bold text-brand-coral">Suggested title</div>
                    <div className="text-lg font-extrabold leading-tight text-brand-ink">{enhancedTopic.title}</div>
                </div>
                <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                    <div className="mb-2 text-xs font-bold text-muted-foreground">Suggested description</div>
                    <div className="text-gray-700 font-medium leading-relaxed">{enhancedTopic.description}</div>
                </div>
                <div className="flex justify-center">
                    <span className="vibrant-tag-rose px-4 py-2">
                        Intent: {enhancedTopic.intent}
                    </span>
                </div>
              </div>
          )}
          <DialogFooter className="flex-col gap-2">
            <Button 
                onClick={() => handlePost(enhancedTopic!)}
                className="action-primary h-12 w-full rounded-xl font-extrabold"
            >
                Accept & Post
            </Button>
            <Button 
                variant="ghost" 
                onClick={() => setEnhancedTopic(null)}
                className="h-10 font-semibold text-muted-foreground"
            >
                Edit Manually
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {posts.map((post) => (
          <Card key={post.id} className="group overflow-hidden rounded-2xl border-border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md animate-in fade-in slide-in-from-bottom-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 border-2 border-indigo-50 shadow-sm">
                        <AvatarImage src={post.authorPhoto} />
                        <AvatarFallback>{post.authorName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="flex items-center gap-2 font-extrabold text-foreground">
                            {post.authorName}
                            <span className="vibrant-tag-indigo">
                                {post.authorNationality === 'TH' ? '🇹🇭 TH' : '🇰🇷 KR'}
                            </span>
                        </div>
                        <div className="text-xs font-semibold text-muted-foreground">
                            {parseApiDate(post.createdAt) ? formatDistanceToNow(parseApiDate(post.createdAt)!) + ' ago' : 'Just now'}

                            {post.intent && (
                                <span className="ml-2 text-brand-ink/60">· {post.intent}</span>
                            )}
                        </div>
                    </div>
                </div>
              </div>

              {post.title && (
                  <h3 className="mb-3 text-xl font-extrabold leading-tight text-brand-ink">
                    {post.title}
                  </h3>
              )}

              <p className="text-gray-700 leading-relaxed mb-6 whitespace-pre-wrap font-medium text-base">
                {post.content}
              </p>

              {translations[post.id] && (
                <div className="mb-6 rounded-2xl border border-brand-ink/10 bg-brand-lilac/45 p-5 animate-in fade-in slide-in-from-top-2">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-brand-ink/60">
                        <Globe className="w-3 h-3" /> AI Insight ({translations[post.id].lang})
                    </div>
                    <p className="font-medium leading-relaxed text-brand-ink">
                        {translations[post.id].text}
                    </p>
                </div>
              )}

              <div className="flex items-center gap-5 border-t border-border pt-5">
                <button 
                    type="button"
                    onClick={() => handleLike(post.id)}
                    aria-label={`Like ${post.title || 'topic'}`}
                    className="flex items-center gap-2 text-muted-foreground transition-all hover:text-brand-coral group/btn"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted transition-colors group-hover/btn:bg-brand-blush">
                        <Heart className="w-4 h-4 group-active/btn:scale-150 transition-transform fill-transparent group-hover/btn:fill-rose-500" />
                    </div>
                    <span className="text-xs font-bold">{post.likesCount || 0}</span>
                </button>
                <button 
                    type="button"
                    onClick={() => handleTranslate(post.id, post.content)}
                    disabled={isTranslating === post.id}
                    aria-label={`Translate ${post.title || 'topic'} to ${translationTarget}`}
                    className="flex items-center gap-2 text-muted-foreground transition-all hover:text-brand-ink group/btn"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted transition-colors group-hover/btn:bg-brand-lilac">
                        {isTranslating === post.id ? (
                            <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Globe className="w-4 h-4" />
                        )}
                    </div>
                    <span className="text-xs font-bold">Translate</span>
                </button>
                <button 
                    type="button"
                    onClick={() => openComments(post)}
                    aria-label={`Open discussion for ${post.title || 'topic'}`}
                    className="flex items-center gap-2 text-muted-foreground transition-all hover:text-brand-ink group/btn"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted transition-colors group-hover/btn:bg-brand-lilac">
                        <MessageSquare className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold">{post.commentsCount || 0}</span>
                </button>
                <button 
                    type="button"
                    onClick={() => reportPost(post)}
                    aria-label={`Report ${post.title || 'topic'}`}
                    className="flex items-center gap-2 text-muted-foreground transition-all hover:text-brand-coral group/btn"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted transition-colors group-hover/btn:bg-brand-blush">
                        <Flag className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold">Report</span>
                </button>
                <button 
                  type="button"
                  onClick={() => showMatchRecommendations(post)}
                  aria-label={`Find match suggestions for ${post.title || 'topic'}`}
                  className="ml-auto flex items-center gap-2 text-brand-coral transition-all hover:text-brand-ink group/btn"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-blush text-[10px] font-extrabold transition-colors group-hover/btn:bg-brand-lilac">
                      AI
                  </div>
                  <span className="text-xs font-bold">Match hint</span>
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedPostForMatch} onOpenChange={() => setSelectedPostForMatch(null)}>
        <DialogContent className="mx-auto max-h-[80vh] max-w-sm overflow-y-auto rounded-2xl border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold text-brand-ink">
                <Star className="w-6 h-6 text-brand-coral" /> Match suggestions
            </DialogTitle>
            <DialogDescription className="text-sm font-medium leading-6 text-muted-foreground">
                People who may respond well to this moment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isMatching ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-brand-coral">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-blush border-t-brand-coral" />
                    <span className="animate-pulse text-xs font-bold">Calculating compatibility...</span>
                </div>
            ) : (
                <div className="space-y-4">
                    {matchingResults.map((res, i) => (
                        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
                            <div className="flex items-center gap-3">
                                <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                                    <AvatarImage src={res.user.photoURL} />
                                    <AvatarFallback>{res.user.displayName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <span className="font-extrabold text-foreground">{res.user.displayName}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-lg font-extrabold text-brand-coral">{res.score}</span>
                                            <span className="text-xs font-semibold text-muted-foreground">match</span>
                                        </div>
                                    </div>
                                    <div className="text-xs font-semibold text-brand-ink/60">
                                        {res.user.intent} · {res.user.nationality === 'TH' ? 'Thailand' : 'Korea'}
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-brand-coral/10 bg-brand-blush/50 p-4 text-sm font-medium leading-relaxed text-foreground">
                                {res.reason}
                            </div>
                            <Button 
                              onClick={() => handleInvite(res.user, selectedPostForMatch)}
                              disabled={invitingUserId === res.user.id}
                              variant="ghost" 
                              className="h-11 w-full rounded-xl border border-border text-sm font-extrabold text-brand-coral shadow-sm hover:bg-brand-blush"
                            >
                                {invitingUserId === res.user.id ? (
                                  <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <><Share2 className="w-3 h-3 mr-2" /> Personal Invite</>
                                )}
                            </Button>
                        </div>
                    ))}
                    {matchingResults.length === 0 && (
                        <div className="py-8 text-center text-sm font-semibold text-muted-foreground">
                            No strong suggestions yet.
                        </div>
                    )}
                </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPostForComments} onOpenChange={() => setSelectedPostForComments(null)}>
        <DialogContent className="mx-auto flex h-[84vh] max-w-2xl flex-col overflow-hidden rounded-2xl border-border bg-white p-0">
          <DialogHeader className="border-b border-border bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 border border-white shadow-sm">
                <AvatarImage src={selectedPostForComments?.authorPhoto} />
                <AvatarFallback>{selectedPostForComments?.authorName?.[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <DialogTitle className="line-clamp-2 text-lg font-extrabold leading-tight text-brand-ink sm:text-xl">
                  {selectedPostForComments?.title || 'Discussion'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                  Started by {selectedPostForComments?.authorName} · {selectedPostForComments?.commentsCount || 0} replies · live discussion
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedPostForComments && (
            <div className="border-b border-border bg-muted/40 px-5 py-4 sm:px-6">
              <p className="line-clamp-3 text-sm font-semibold leading-6 text-foreground">
                {selectedPostForComments.content}
              </p>
            </div>
          )}

          <div className="flex-1 space-y-5 overflow-y-auto bg-muted/30 p-5 sm:p-6">
            {loadingComments && (
              <div className="py-10 text-center text-sm font-semibold text-muted-foreground">
                Loading discussion...
              </div>
            )}

            {!loadingComments && comments.map((comment) => {
              const isMe = comment.authorId === profile?.uid;
              const createdAt = parseApiDate(comment.createdAt);
              const isSticker = comment.messageType === 'sticker';

              return (
                <div key={comment.id} className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && (
                    <Avatar className="h-9 w-9 flex-shrink-0 border border-white shadow-sm">
                      <AvatarImage src={comment.authorPhoto} />
                      <AvatarFallback>{comment.authorName?.[0]}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[82%] space-y-1 ${isMe ? 'items-end text-right' : ''}`}>
                    <div className={`flex items-center gap-2 text-xs font-bold text-brand-ink/55 ${isMe ? 'justify-end' : ''}`}>
                      <span>{isMe ? 'You' : comment.authorName}</span>
                      {comment.authorNationality && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-brand-ink/55">
                          {comment.authorNationality}
                        </span>
                      )}
                      {createdAt && (
                        <span className="font-semibold text-muted-foreground">
                          {formatDistanceToNow(createdAt)} ago
                        </span>
                      )}
                    </div>
                    {isSticker ? (
                      renderDiscussionSticker(comment.stickerId, comment.text, isMe)
                    ) : (
                      <div className={`rounded-2xl p-4 text-sm font-medium leading-6 shadow-sm ${
                        isMe
                          ? 'rounded-tr-sm bg-brand-ink text-white'
                          : 'rounded-tl-sm border border-border bg-white text-foreground'
                      }`}>
                        {comment.text}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {!loadingComments && comments.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm font-semibold leading-6 text-muted-foreground">
                  No replies yet. Start the discussion with a real question, a useful detail, or a kind first hello.
                </div>
            )}
            <div ref={discussionBottomRef} />
          </div>

          <div className="space-y-4 border-t border-border bg-white p-5 sm:p-6">
            {discussionStickerTrayOpen && (
              <div className="rounded-2xl border border-border bg-muted/35 p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-brand-ink">Pro discussion stickers</p>
                    <p className="text-xs font-semibold text-muted-foreground">Send reactions into topic replies.</p>
                  </div>
                  <div className="inline-flex rounded-xl border border-border bg-white p-1">
                    {(['TH', 'KR'] as const).map((locale) => (
                      <button
                        key={locale}
                        type="button"
                        aria-pressed={discussionStickerLocale === locale}
                        onClick={() => setDiscussionStickerLocale(locale)}
                        className={`h-8 rounded-lg px-3 text-xs font-black transition ${
                          discussionStickerLocale === locale ? 'bg-brand-ink text-white' : 'text-muted-foreground hover:bg-muted hover:text-brand-ink'
                        }`}
                      >
                        {locale}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {basicStickers.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      onClick={() => sendDiscussionSticker(sticker)}
                      disabled={sendingComment || !canUseDiscussionStickers}
                      aria-label={`Send ${getStickerLabel(sticker, discussionStickerLocale)} sticker to discussion`}
                      className={`min-h-20 rounded-2xl border p-2 text-center transition hover:-translate-y-0.5 hover:shadow-sm active:scale-95 disabled:pointer-events-none disabled:opacity-60 ${stickerToneClass(sticker.tone)}`}
                    >
                      <div className="text-2xl leading-none">{sticker.emoji}</div>
                      <div className="mt-2 line-clamp-2 text-[11px] font-black leading-4">{getStickerLabel(sticker, discussionStickerLocale)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingSuggestions ? (
                <div className="flex gap-2 animate-pulse">
                    <div className="h-6 w-16 bg-gray-100 rounded-full" />
                    <div className="h-6 w-20 bg-gray-100 rounded-full" />
                    <div className="h-6 w-12 bg-gray-100 rounded-full" />
                </div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {replySuggestions.map((s, i) => (
                        <button 
                            type="button"
                            key={i}
                            onClick={() => setNewComment(s.text)}
                            className="rounded-full border border-brand-coral/15 bg-brand-blush px-3 py-1.5 text-xs font-bold text-brand-coral transition-all hover:bg-brand-coral hover:text-white active:scale-95"
                        >
                            {s.style}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <Button
                    aria-label={discussionStickerTrayOpen ? 'Close discussion stickers' : 'Open discussion stickers'}
                    aria-pressed={discussionStickerTrayOpen}
                    onClick={() => {
                      if (!canUseDiscussionStickers) {
                        toast.error('Discussion stickers are a Pro feature');
                        return;
                      }
                      setDiscussionStickerTrayOpen((open) => !open);
                    }}
                    variant="outline"
                    className={`h-12 w-12 flex-shrink-0 rounded-xl p-0 ${canUseDiscussionStickers ? 'text-brand-coral' : 'text-muted-foreground'}`}
                    title={canUseDiscussionStickers ? 'Pro stickers' : 'Pro stickers only'}
                >
                    {canUseDiscussionStickers ? <SmilePlus className="w-5 h-5" /> : <LockKeyhole className="w-5 h-5" />}
                </Button>
                <Textarea 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handlePostComment();
                      }
                    }}
                    placeholder="Reply in this discussion..."
                    className="min-h-12 resize-none rounded-xl border-none bg-muted px-4 py-3 font-medium focus-visible:ring-brand-coral/30"
                />
                <Button 
                    aria-label="Send discussion reply"
                    onClick={handlePostComment}
                    disabled={sendingComment || !newComment.trim()}
                    className="h-12 w-12 flex-shrink-0 rounded-xl bg-brand-coral p-0 shadow-sm"
                >
                    {sendingComment ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <Send className="w-5 h-5 text-white" />
                    )}
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reportTarget} onOpenChange={(open) => !open && setReportTarget(null)}>
        <DialogContent className="rounded-2xl border-border bg-white shadow-[0_24px_70px_oklch(0.25_0.07_282/16%)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-brand-ink">Report discussion</DialogTitle>
            <DialogDescription className="leading-6">
              Tell safety what should be reviewed. Reports are private and help keep real chat trustworthy.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
            placeholder="Spam, scam, harassment, unsafe content, or another concern..."
            className="min-h-28 rounded-xl bg-muted/60"
          />
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setReportTarget(null)}>
              Cancel
            </Button>
            <Button className="action-primary h-11 rounded-xl font-extrabold" disabled={!reportReason.trim()} onClick={submitPostReport}>
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
