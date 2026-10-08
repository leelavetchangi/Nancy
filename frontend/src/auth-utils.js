export const rolePaths = {
  customer: '/customer/dashboard',
  agent: '/agent/dashboard',
  supervisor: '/supervisor/dashboard',
  admin: '/admin/dashboard',
}

export const roleLabels = {
  customer: 'Customer',
  agent: 'Support Agent',
  supervisor: 'Supervisor',
  admin: 'Administrator',
}

export function roleDestination(role) {
  return rolePaths[role] || '/login'
}
