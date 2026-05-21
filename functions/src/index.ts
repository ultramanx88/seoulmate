import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// DATABASE ID from firebase-applet-config.json
const FIRESTORE_DATABASE_ID = "ai-studio-554b0bce-d0ca-41ea-a58d-589a73ebfb99";
const db = getFirestore(FIRESTORE_DATABASE_ID);

// --- CONFIG & CACHES ---
const GLOBAL_TOPICS_TTL = 60 * 1000; // 1 minute
const PRECOMPUTE_BATCH_SIZE = 100;
const ACTIVE_USER_THRESHOLD_HOURS = 24;

// Global memory cache for Recent Topics
let globalTopicsCache: { topics: Topic[], timestamp: number } | null = null;
const userProfileMemoryCache = new Map<string, { profile: UserProfile, timestamp: number }>();
const USER_PROFILE_MEMORY_TTL = 10 * 60 * 1000; // 10 minutes

// --- INTERFACES ---
interface UserProfile {
  interests?: string[];
  intent: string;
  location?: {
    city: string;
    country: string;
  };
  lastActiveAt?: admin.firestore.Timestamp;
}

interface Topic {
  id: string;
  content: string;
  tags: string[];
  intent: string;
  location?: {
    city: string;
    country: string;
  };
  commentsCount: number;
  likesCount: number;
  createdAt: admin.firestore.Timestamp;
}

// --- RANKING HELPERS ---

const calculateAffinity = (userInterestSet: Set<string>, topicTags: string[]): number => {
  if (userInterestSet.size === 0 || !topicTags || !topicTags.length) return 0;
  let overlapCount = 0;
  for (const tag of topicTags) {
    if (userInterestSet.has(tag.toLowerCase())) overlapCount++;
  }
  return overlapCount / userInterestSet.size;
};

const calculateEngagement = (commentsCount: number, likesCount: number): number => {
  return Math.log1p((commentsCount || 0) + ((likesCount || 0) * 2));
};

const calculateFreshness = (createdAt: admin.firestore.Timestamp): number => {
  if (!createdAt || typeof createdAt.toMillis !== 'function') return 0;
  try {
    const hoursSinceCreated = (Date.now() - createdAt.toMillis()) / (1000 * 60 * 60);
    return Math.exp(-Math.max(0, hoursSinceCreated) / 24);
  } catch (e) {
    return 0;
  }
};

const calculateIntentMatch = (userIntent: string, topicIntent: string): number => {
  return userIntent === topicIntent ? 1.0 : 0.5;
};

const calculateLocationBoost = (userLoc: any, topicLoc: any): number => {
  if (!userLoc || !topicLoc) return 0;
  if (userLoc.city === topicLoc.city) return 1.0;
  if (userLoc.country === topicLoc.country) return 0.5;
  return 0;
};

/**
 * CORE LOGIC: Rank topics for a specific user
 */
const rankTopicsForUser = (user: UserProfile, topics: Topic[]): any[] => {
  const userInterestSet = new Set((user.interests || []).map(i => i.toLowerCase()));

  const ranked = topics.map(topic => {
    const affinity = calculateAffinity(userInterestSet, topic.tags || []);
    const engagement = calculateEngagement(topic.commentsCount, topic.likesCount);
    const freshness = calculateFreshness(topic.createdAt);
    const intentMatch = calculateIntentMatch(user.intent || "", topic.intent || "");
    const locationBoost = calculateLocationBoost(user.location, topic.location);

    const score = 
      (affinity * 0.35) +
      (engagement * 0.25) +
      (freshness * 0.20) +
      (intentMatch * 0.10) +
      (locationBoost * 0.05);

    return { ...topic, rankScore: isNaN(score) ? 0 : score };
  });

  return ranked
    .sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
    .slice(0, 20);
};

/**
 * FETCH RECENT TOPICS (Cached in instance memory)
 */
const getRecentTopics = async (): Promise<Topic[]> => {
  const now = Date.now();
  if (globalTopicsCache && (now - globalTopicsCache.timestamp < GLOBAL_TOPICS_TTL)) {
    return globalTopicsCache.topics;
  }

  try {
    const fortyEightHoursAgo = admin.firestore.Timestamp.fromMillis(now - 48 * 60 * 60 * 1000);
    const snapshot = await db.collection("topics")
      .where("createdAt", ">=", fortyEightHoursAgo)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const topics = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Topic))
      .filter(t => t.createdAt && typeof t.createdAt.toMillis === 'function');
    globalTopicsCache = { topics, timestamp: now };
    console.log(`Fetched ${topics.length} recent topics for cache.`);
    return topics;
  } catch (err) {
    console.error("Failed to fetch topics from DB in getRecentTopics:", err);
    return [];
  }
};

/**
 * BACKGROUND TASK: Refresh feed for a specific user
 */
const refreshUserFeed = async (userId: string, topics?: Topic[]) => {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;
    const user = userDoc.data() as UserProfile;

    const topicsToRank = topics || await getRecentTopics();
    if (topicsToRank.length === 0) return;

    const finalTopics = rankTopicsForUser(user, topicsToRank);

    await db.collection("precomputed_feeds").doc(userId).set({
      userId,
      topics: finalTopics,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Precomputed feed updated for user: ${userId}`);
  } catch (err) {
    console.error(`Failed to refresh feed for user ${userId}:`, err);
  }
};

// --- CLOUD FUNCTIONS ---

/**
 * API: Get Ranked Topics (Callable)
 * Reads from precomputed_feeds first, fallbacks if missing or old.
 */
export const getRankedTopics = onCall({ region: "asia-southeast1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const userId = request.auth.uid;
  const now = Date.now();

  try {
    console.log(`getRankedTopics triggered for user: ${userId}`);
    
    // 1. Check permissions manually in function context if needed, 
    // but here we are using Admin SDK which bypasses rules.
    
    const feedDoc = await db.collection("precomputed_feeds").doc(userId).get();
    
    if (feedDoc.exists) {
      const data = feedDoc.data() as any;
      const updatedAt = data?.updatedAt?.toMillis() || 0;
      if (now - updatedAt < 5 * 60 * 1000) {
        console.log("Returning precomputed feed");
        return data?.topics;
      }
    }

    console.log("No precomputed feed found or expired, ranking now...");
    let user: UserProfile;
    const profileCached = userProfileMemoryCache.get(userId);
    
    if (profileCached && (now - profileCached.timestamp < USER_PROFILE_MEMORY_TTL)) {
      user = profileCached.profile;
    } else {
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        console.warn(`User ${userId} has no profile Doc`);
        // Instead of throwing, maybe return an empty list or a specific code
        return []; 
      }
      user = userDoc.data() as UserProfile;
      userProfileMemoryCache.set(userId, { profile: user, timestamp: now });
    }

    const topics = await getRecentTopics();
    if (topics.length === 0) {
        console.log("No topics fetched from DB");
        return [];
    }

    const ranked = rankTopicsForUser(user, topics);
    
    // Background refresh
    refreshUserFeed(userId, topics).catch(e => console.error("Async background refresh failed:", e));

    return ranked;
  } catch (error: any) {
    console.error("FUNCTION ERROR DEBUG:", error);
    const status = error instanceof HttpsError ? error.code : "internal";
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : "";
    throw new HttpsError(status as any, `Ranker Error: ${message}. Stack: ${stack}`);
  }
});

/**
 * TRIGGER: On Topic Created
 */
export const onTopicCreated = onDocumentCreated({
    document: "topics/{topicId}",
    database: FIRESTORE_DATABASE_ID
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    
    console.log(`New topic created: ${event.params.topicId}`);
    const topics = await getRecentTopics();
    const activeThreshold = admin.firestore.Timestamp.fromMillis(Date.now() - ACTIVE_USER_THRESHOLD_HOURS * 60 * 60 * 1000);
    const activeUsers = await db.collection("users")
      .where("lastActiveAt", ">=", activeThreshold)
      .limit(200)
      .get();

    const tasks = activeUsers.docs.map(userDoc => refreshUserFeed(userDoc.id, topics));
    await Promise.allSettled(tasks);
});

/**
 * TRIGGER: On Engagement Change
 */
export const onTopicUpdated = onDocumentUpdated({
    document: "topics/{topicId}",
    database: FIRESTORE_DATABASE_ID
}, async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data() as Topic;
    const after = change.after.data() as Topic;

    const beforeEng = (before.commentsCount || 0) + (before.likesCount || 0);
    const afterEng = (after.commentsCount || 0) + (after.likesCount || 0);

    // Update if crossed a threshold of 20 interaction score
    if (Math.floor(afterEng / 20) > Math.floor(beforeEng / 20)) {
      console.log(`Topic becoming hot: ${event.params.topicId}`);
      const topics = await getRecentTopics();
      const activeThreshold = admin.firestore.Timestamp.fromMillis(Date.now() - ACTIVE_USER_THRESHOLD_HOURS * 60 * 60 * 1000);
      const activeUsers = await db.collection("users")
        .where("lastActiveAt", ">=", activeThreshold)
        .limit(100)
        .get();

      const tasks = activeUsers.docs.map(userDoc => refreshUserFeed(userDoc.id, topics));
      await Promise.allSettled(tasks);
    }
});

/**
 * SCHEDULED: Regular Batch Precompute
 */
export const scheduledPrecompute = onSchedule("every 10 minutes", async (event) => {
  const topics = await getRecentTopics();
  if (topics.length === 0) return;

  const activeThreshold = admin.firestore.Timestamp.fromMillis(Date.now() - ACTIVE_USER_THRESHOLD_HOURS * 60 * 60 * 1000);
  const activeUsers = await db.collection("users")
    .where("lastActiveAt", ">=", activeThreshold)
    .limit(500)
    .get();

  console.log(`Starting scheduled precompute for ${activeUsers.size} users`);
  const tasks = activeUsers.docs.map(userDoc => refreshUserFeed(userDoc.id, topics));
  await Promise.allSettled(tasks);
});
