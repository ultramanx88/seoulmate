import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest, parseApiDate } from '../lib/api';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Flag, Heart, MessageSquare, Send, Globe, Sparkles, Wand2, UserCheck, Star, Share2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { geminiService } from '../services/gemini';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';

export default function Feed() {
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
  const [translations, setTranslations] = useState<Record<string, { text: string; lang: string }>>({});
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  
  const [selectedPostForComments, setSelectedPostForComments] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replySuggestions, setReplySuggestions] = useState<{ style: string; text: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

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
    const reason = window.prompt('What should safety review?');
    if (!reason?.trim()) return;
    try {
      await apiRequest('/v1/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'topic',
          targetId: post.id,
          reportedUserId: post.authorId,
          reason,
        }),
      });
      toast.success('Report sent to safety review');
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
      // Simulate sending a "connected" notification/message
      toast.success(`Invitation sent to ${user.displayName}!`, {
        description: `"${invitation}"`,
        duration: 5000,
      });
    } catch (e) {
      toast.error("Failed to generate invitation");
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
      const targetLang = profile?.nationality === 'TH' ? 'TH' : 'KR';
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

  const openComments = async (post: any) => {
    setSelectedPostForComments(post);
    setNewComment('');
    setReplySuggestions([]);

    try {
      const result = await apiRequest<{ comments: any[] }>(`/v1/topics/${post.id}/comments`);
      setComments(result.comments);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load comments");
    }

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

  const handlePostComment = async () => {
    if (!newComment.trim() || !selectedPostForComments) return;
    
    try {
        const result = await apiRequest<{ comment: any }>(`/v1/topics/${selectedPostForComments.id}/comments`, {
          method: 'POST',
          body: JSON.stringify({ text: newComment }),
        });
        setComments((previous) => [...previous, result.comment]);
        setPosts((previous) =>
          previous.map((post) =>
            post.id === selectedPostForComments.id
              ? { ...post, commentsCount: (post.commentsCount || 0) + 1 }
              : post
          )
        );
        setNewComment('');
        toast.success("Comment posted");
    } catch (e) {
        toast.error("Failed to post comment");
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
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-2 text-muted-foreground transition-all hover:text-brand-coral group/btn"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted transition-colors group-hover/btn:bg-brand-blush">
                        <Heart className="w-4 h-4 group-active/btn:scale-150 transition-transform fill-transparent group-hover/btn:fill-rose-500" />
                    </div>
                    <span className="text-xs font-bold">{post.likesCount || 0}</span>
                </button>
                <button 
                    onClick={() => handleTranslate(post.id, post.content)}
                    disabled={isTranslating === post.id}
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
                    onClick={() => openComments(post)}
                    className="flex items-center gap-2 text-muted-foreground transition-all hover:text-brand-ink group/btn"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted transition-colors group-hover/btn:bg-brand-lilac">
                        <MessageSquare className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold">{post.commentsCount || 0}</span>
                </button>
                <button 
                    onClick={() => reportPost(post)}
                    className="flex items-center gap-2 text-muted-foreground transition-all hover:text-brand-coral group/btn"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted transition-colors group-hover/btn:bg-brand-blush">
                        <Flag className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold">Report</span>
                </button>
                <button 
                  onClick={() => showMatchRecommendations(post)}
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
        <DialogContent className="mx-auto flex h-[80vh] max-w-sm flex-col overflow-hidden rounded-2xl border-border bg-white p-0">
          <DialogHeader className="border-b border-border bg-white p-6">
            <DialogTitle className="text-xl font-extrabold text-brand-ink">Comments</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                    <Avatar className="w-8 h-8 border border-white shadow-sm flex-shrink-0">
                        <AvatarImage src={comment.authorPhoto} />
                        <AvatarFallback>{comment.authorName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                        <div className="text-xs font-bold text-brand-ink/60">{comment.authorName}</div>
                        <div className="rounded-2xl rounded-tl-sm border border-border bg-white p-4 text-sm font-medium leading-relaxed text-foreground shadow-sm">
                            {comment.text}
                        </div>
                    </div>
                </div>
            ))}
            {comments.length === 0 && (
                <div className="py-12 text-center text-sm font-semibold text-muted-foreground">No comments yet.</div>
            )}
          </div>

          <div className="space-y-4 border-t border-border bg-white p-6">
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
                <Textarea 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="h-12 resize-none rounded-xl border-none bg-muted px-4 py-3 font-medium focus-visible:ring-brand-coral/30"
                />
                <Button 
                    onClick={handlePostComment}
                    disabled={!newComment.trim()}
                    className="h-12 w-12 flex-shrink-0 rounded-xl bg-brand-coral p-0 shadow-sm"
                >
                    <Send className="w-5 h-5 text-white" />
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
