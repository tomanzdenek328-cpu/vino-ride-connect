interface Member { user_id: string; role: string }
interface Activity { kind: 'chat' | 'sos'; senderId: string; participants?: string[] | null; threadKey?: string }

export function activityRecipients(members: Member[], helpers: string[], activity: Activity): string[] {
  const helperIds = new Set(helpers);
  return [...new Set(members.filter(member => {
    if (!['driver', 'dispatcher'].includes(member.role) || member.user_id === activity.senderId) return false;
    if (activity.kind === 'sos') return !helperIds.has(member.user_id);
    return activity.participants == null || activity.participants.includes(member.user_id) ||
      (!!activity.threadKey?.startsWith('dispatch:') && member.role === 'dispatcher');
  }).map(member => member.user_id))];
}