/**
 * TikTok-style Recommendation Engine
 * Personalizes video order based on user engagement patterns
 */

export interface VideoMeta {
  content_id: string;
  tags: string[];
  duration?: number;
  globalPopularity?: number;
}

interface UserProfile {
  interestVector: Record<string, number>;
  watchHistory: string[];
  lastUpdated: number;
}

const STORAGE_KEY = "mmvp_user_profile";
const LEARNING_RATE = 0.15;
const HISTORY_LIMIT = 50;

// Get user profile from localStorage
function getUserProfile(): UserProfile {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load user profile:", e);
  }
  return {
    interestVector: {},
    watchHistory: [],
    lastUpdated: Date.now(),
  };
}

// Save user profile to localStorage
function saveUserProfile(profile: UserProfile): void {
  try {
    profile.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn("Failed to save user profile:", e);
  }
}

/**
 * Update user interests based on engagement
 * @param tags - Tags of the video watched
 * @param engagementScore - Positive (liked/watched) or negative (skipped)
 *   - Full watch: +1.0
 *   - Partial watch (>50%): +0.5
 *   - Quick skip (<20%): -0.3
 *   - Ad skip: 0 (neutral)
 */
export function updateUserInterest(tags: string[], engagementScore: number): void {
  const profile = getUserProfile();
  
  for (const tag of tags) {
    const currentWeight = profile.interestVector[tag] ?? 0.5; // Start neutral
    const newWeight = currentWeight + (LEARNING_RATE * engagementScore);
    // Cap weights between 0.01 and 5.0
    profile.interestVector[tag] = Math.max(0.01, Math.min(newWeight, 5.0));
  }
  
  saveUserProfile(profile);
}

/**
 * Record that a video was watched
 */
export function recordWatch(contentId: string): void {
  const profile = getUserProfile();
  
  // Add to history, remove duplicates, limit size
  profile.watchHistory = [
    contentId,
    ...profile.watchHistory.filter(id => id !== contentId)
  ].slice(0, HISTORY_LIMIT);
  
  saveUserProfile(profile);
}

/**
 * Calculate recommendation score for a video
 */
function calculateScore(profile: UserProfile, video: VideoMeta): number {
  // Penalize recently watched videos
  const recentHistory = profile.watchHistory.slice(0, 20);
  if (recentHistory.includes(video.content_id)) {
    return -10.0;
  }
  
  // Calculate tag affinity
  let affinityScore = 0;
  for (const tag of video.tags) {
    if (tag in profile.interestVector) {
      affinityScore += profile.interestVector[tag];
    } else {
      // Slight exploration bonus for unknown tags
      affinityScore += 0.5;
    }
  }
  
  // Normalize affinity
  const avgAffinity = affinityScore / Math.max(1, video.tags.length);
  
  // Global popularity (default to 0.5 if not set)
  const popularity = video.globalPopularity ?? 0.5;
  
  // Combine: 70% personal relevance, 30% trending
  const finalScore = (avgAffinity * 0.7) + (popularity * 0.3);
  
  // Add random noise for exploration (prevents filter bubble)
  const noise = (Math.random() - 0.5) * 0.1;
  
  return finalScore + noise;
}

/**
 * Sort videos by recommendation score for this user
 */
export function rankVideos<T extends VideoMeta>(videos: T[]): T[] {
  const profile = getUserProfile();
  
  // Calculate scores and sort
  const scored = videos.map(video => ({
    video,
    score: calculateScore(profile, video),
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.map(s => s.video);
}

/**
 * Get engagement score based on watch percentage
 */
export function getEngagementScore(watchPercentage: number, wasSkipped: boolean): number {
  if (wasSkipped) {
    return watchPercentage < 0.2 ? -0.3 : 0; // Quick skip is negative
  }
  
  if (watchPercentage >= 0.9) return 1.0;      // Full watch
  if (watchPercentage >= 0.5) return 0.5;      // Partial watch
  if (watchPercentage >= 0.2) return 0.1;      // Brief watch
  return -0.2;                                  // Very short = not interested
}

/**
 * Reset user profile (for testing)
 */
export function resetUserProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
}

