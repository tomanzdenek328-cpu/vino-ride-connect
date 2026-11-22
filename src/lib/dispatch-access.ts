export type DispatchAccess = "main" | "helper" | null;

export function canManageDriverRoles(role: string | null, access: DispatchAccess) {
  return role === "dispatcher" && access === "main";
}

export function canAddOrders(role: string | null, access: DispatchAccess) {
  return role === "dispatcher" || (role === "driver" && access === "helper");
}

export function canSeeOtherDrivers(role: string | null, access: DispatchAccess) {
  return (role === "driver" || role === "dispatcher") && access !== "helper";
}