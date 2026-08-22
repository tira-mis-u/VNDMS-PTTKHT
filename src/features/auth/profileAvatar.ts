const PROFILE_AVATAR_PREFIX = "vndms.profile.avatar.";
export const PROFILE_AVATAR_CHANGED = "vndms:profile-avatar-changed";

export function loadProfileAvatar(userId: string): string | null {
  try {
    return localStorage.getItem(`${PROFILE_AVATAR_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

export function saveProfileAvatar(userId: string, dataUrl: string | null) {
  const key = `${PROFILE_AVATAR_PREFIX}${userId}`;
  if (dataUrl) localStorage.setItem(key, dataUrl);
  else localStorage.removeItem(key);
  window.dispatchEvent(
    new CustomEvent(PROFILE_AVATAR_CHANGED, { detail: { userId } }),
  );
}
