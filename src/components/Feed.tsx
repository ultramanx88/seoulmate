import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest, parseApiDate } from '../lib/api';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Heart, MessageSquare, Send, Globe, Sparkles, Wand2, UserCheck, Star, Share2 } from 'lucide-react';
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
      toast.error("Failed to share moment");
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
      toast.error("Match analysis failed");
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
      const translated = await geminiService.translatePost(content, targetLang as any);
      setTranslations(prev => ({
        ...prev,
        [postId]: { text: translated, lang: targetLang }
      }));
    } catch (e) {
      toast.error("Translation failed");
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
      toast.error("Failed to load whispers");
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
        toast.success("Comment whispered!");
    } catch (e) {
        toast.error("Failed to whisper");
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-rose-100 border border-rose-50">
        <div className="flex gap-4 mb-4">
            <Avatar className="w-12 h-12 border-2 border-rose-100 shadow-sm">
                <AvatarImage src={profile?.photoURL} />
                <AvatarFallback>{profile?.displayName?.[0]}</AvatarFallback>
            </Avatar>
            <Textarea 
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's happening in your soul?"
                className="border-none bg-transparent focus-visible:ring-0 resize-none min-h-[80px] font-bold text-lg p-0 placeholder:text-gray-300"
            />
        </div>
        <div className="flex justify-end gap-2">
            <Button 
                onClick={handleEnhance}
                disabled={isEnhancing || !newPost.trim()}
                variant="outline"
                className="rounded-full border-rose-200 text-rose-500 hover:bg-rose-50 font-bold px-6 h-12"
            >
                {isEnhancing ? "Refining..." : <><Wand2 className="w-4 h-4 mr-2" /> AI Polish</>}
            </Button>
            <Button 
                onClick={() => handlePost()} 
                disabled={submitting || !newPost.trim()}
                className="vibrant-gradient text-white font-black hover:opacity-90 rounded-full py-4 px-8 shadow-lg shadow-rose-200 transition-all hover:-translate-y-0.5 active:translate-y-0 h-12"
            >
                <Send className="w-5 h-5 mr-3" /> Share Moment
            </Button>
        </div>
      </div>

      <Dialog open={!!enhancedTopic} onOpenChange={() => setEnhancedTopic(null)}>
        <DialogContent className="rounded-[2.5rem] border-rose-50 max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic tracking-tighter text-gray-800 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-500" /> AI Refined Moment
            </DialogTitle>
          </DialogHeader>
          {enhancedTopic && (
              <div className="space-y-4 py-4">
                <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-rose-300 mb-2">Engaging Title</div>
                    <div className="text-lg font-black text-rose-600 italic leading-tight">{enhancedTopic.title}</div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2">Inviting Description</div>
                    <div className="text-gray-700 font-medium leading-relaxed">{enhancedTopic.description}</div>
                </div>
                <div className="flex justify-center">
                    <span className="vibrant-tag-rose text-[10px] font-black uppercase tracking-widest px-4 py-2">
                        Intent: {enhancedTopic.intent}
                    </span>
                </div>
              </div>
          )}
          <DialogFooter className="flex-col gap-2">
            <Button 
                onClick={() => handlePost(enhancedTopic!)}
                className="vibrant-gradient text-white font-black h-14 rounded-2xl shadow-xl shadow-rose-200 w-full"
            >
                Accept & Post
            </Button>
            <Button 
                variant="ghost" 
                onClick={() => setEnhancedTopic(null)}
                className="text-gray-400 font-bold uppercase tracking-widest text-[10px] h-10"
            >
                Edit Manually
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {posts.map((post) => (
          <Card key={post.id} className="rounded-[2.5rem] border-rose-50 shadow-xl shadow-rose-100/50 overflow-hidden bg-white group transition-all hover:shadow-2xl hover:shadow-rose-100 animate-in fade-in slide-in-from-bottom-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 border-2 border-indigo-50 shadow-sm">
                        <AvatarImage src={post.authorPhoto} />
                        <AvatarFallback>{post.authorName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="font-black text-gray-900 flex items-center gap-2 italic">
                            {post.authorName}
                            <span className="vibrant-tag-indigo">
                                {post.authorNationality === 'TH' ? '🇹🇭 TH' : '🇰🇷 KR'}
                            </span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                            {parseApiDate(post.createdAt) ? formatDistanceToNow(parseApiDate(post.createdAt)!) + ' ago' : 'Just now'}

                            {post.intent && (
                                <span className="ml-2 text-indigo-400">· {post.intent}</span>
                            )}
                        </div>
                    </div>
                </div>
              </div>

              {post.title && (
                  <h3 className="text-xl font-black italic tracking-tighter text-rose-600 mb-3 leading-tight">
                    {post.title}
                  </h3>
              )}

              <p className="text-gray-700 leading-relaxed mb-6 whitespace-pre-wrap font-medium text-base">
                {post.content}
              </p>

              {translations[post.id] && (
                <div className="mb-6 p-5 rounded-[2rem] bg-indigo-50/30 border border-indigo-100/50 animate-in fade-in slide-in-from-top-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-2 flex items-center gap-1.5">
                        <Globe className="w-3 h-3" /> AI Insight ({translations[post.id].lang})
                    </div>
                    <p className="text-indigo-900 leading-relaxed font-medium italic">
                        {translations[post.id].text}
                    </p>
                </div>
              )}

              <div className="flex items-center gap-6 pt-6 border-t border-rose-50">
                <button 
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-2 text-gray-400 hover:text-rose-500 transition-all group/btn"
                >
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center transition-colors group-hover/btn:bg-rose-50">
                        <Heart className="w-4 h-4 group-active/btn:scale-150 transition-transform fill-transparent group-hover/btn:fill-rose-500" />
                    </div>
                    <span className="text-xs font-black tracking-tight">{post.likesCount || 0}</span>
                </button>
                <button 
                    onClick={() => handleTranslate(post.id, post.content)}
                    disabled={isTranslating === post.id}
                    className="flex items-center gap-2 text-gray-400 hover:text-indigo-500 transition-all group/btn"
                >
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center transition-colors group-hover/btn:bg-indigo-50">
                        {isTranslating === post.id ? (
                            <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Globe className="w-4 h-4" />
                        )}
                    </div>
                    <span className="text-xs font-black tracking-tight">Translate</span>
                </button>
                <button 
                    onClick={() => openComments(post)}
                    className="flex items-center gap-2 text-gray-400 hover:text-indigo-500 transition-all group/btn"
                >
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center transition-colors group-hover/btn:bg-indigo-50">
                        <MessageSquare className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black tracking-tight">{post.commentsCount || 0}</span>
                </button>
                <button 
                  onClick={() => showMatchRecommendations(post)}
                  className="flex items-center gap-2 text-rose-500 hover:text-rose-600 transition-all group/btn ml-auto"
                >
                  <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center transition-colors group-hover/btn:bg-rose-100 italic font-black text-[10px]">
                      AI
                  </div>
                  <span className="text-xs font-black tracking-tight uppercase">Soul Match</span>
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedPostForMatch} onOpenChange={() => setSelectedPostForMatch(null)}>
        <DialogContent className="rounded-[2.5rem] border-rose-50 max-w-sm mx-auto max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic tracking-tighter text-gray-800 flex items-center gap-2">
                <Star className="w-6 h-6 text-rose-500" /> AI Soul Matching
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-loose">
                Identifying souls most likely to resonate with this moment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isMatching ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4 text-rose-500">
                    <div className="w-12 h-12 border-4 border-rose-100 border-t-rose-500 rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Calculating Compatibility...</span>
                </div>
            ) : (
                <div className="space-y-4">
                    {matchingResults.map((res, i) => (
                        <div key={i} className="bg-white p-5 rounded-[2rem] border border-rose-50 shadow-lg shadow-rose-100/30 flex flex-col gap-3 transition-transform hover:scale-[1.02]">
                            <div className="flex items-center gap-3">
                                <Avatar className="w-12 h-12 border-2 border-indigo-50 shadow-sm">
                                    <AvatarImage src={res.user.photoURL} />
                                    <AvatarFallback>{res.user.displayName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <span className="font-black italic text-gray-800">{res.user.displayName}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-lg font-black text-rose-500">{res.score}</span>
                                            <span className="text-[8px] font-black text-rose-300 uppercase">Match</span>
                                        </div>
                                    </div>
                                    <div className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">
                                        {res.user.intent} · {res.user.nationality === 'TH' ? 'THAILAND' : 'KOREA'}
                                    </div>
                                </div>
                            </div>
                            <div className="bg-rose-50/50 p-4 rounded-2xl text-[11px] font-medium text-gray-600 italic leading-relaxed border border-rose-100/50">
                                "{res.reason}"
                            </div>
                            <Button 
                              onClick={() => handleInvite(res.user, selectedPostForMatch)}
                              disabled={invitingUserId === res.user.id}
                              variant="ghost" 
                              className="w-full rounded-xl border border-rose-100 text-rose-500 font-black uppercase text-[10px] tracking-widest h-12 shadow-sm hover:bg-rose-50"
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
                        <div className="py-8 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                            No matches found in this vicinity.
                        </div>
                    )}
                </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPostForComments} onOpenChange={() => setSelectedPostForComments(null)}>
        <DialogContent className="rounded-[2.5rem] border-rose-50 max-w-sm mx-auto flex flex-col h-[80vh] p-0 overflow-hidden bg-rose-50/10 backdrop-blur-xl">
          <DialogHeader className="p-6 bg-white/80 border-b border-rose-100">
            <DialogTitle className="text-xl font-black italic tracking-tighter text-gray-800">Soul Whispers</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                    <Avatar className="w-8 h-8 border border-white shadow-sm flex-shrink-0">
                        <AvatarImage src={comment.authorPhoto} />
                        <AvatarFallback>{comment.authorName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{comment.authorName}</div>
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm text-sm font-medium text-gray-700 leading-relaxed border border-rose-50">
                            {comment.text}
                        </div>
                    </div>
                </div>
            ))}
            {comments.length === 0 && (
                <div className="py-12 text-center text-gray-300 font-bold uppercase tracking-widest text-[10px]">No whispers yet...</div>
            )}
          </div>

          <div className="p-6 bg-white border-t border-rose-100 space-y-4">
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
                            className="px-3 py-1.5 rounded-full bg-rose-50 text-[10px] font-black text-rose-500 uppercase tracking-widest border border-rose-100 transition-all hover:bg-rose-500 hover:text-white active:scale-95"
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
                    placeholder="Whisper something..."
                    className="rounded-2xl bg-gray-50 border-none resize-none h-12 py-3 px-4 font-medium focus-visible:ring-rose-200"
                />
                <Button 
                    onClick={handlePostComment}
                    disabled={!newComment.trim()}
                    className="w-12 h-12 rounded-2xl bg-rose-500 p-0 flex-shrink-0 shadow-lg shadow-rose-100"
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
