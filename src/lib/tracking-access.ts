/** A ride code must not become a permanent link to a driver's live GPS. */
export function canShareDriverLocation(status: string): boolean {
  return status === 'assigned' || status === 'accepted' || status === 'in_progress';
}