export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthMembership {
  businessId: string;
  businessName: string;
  role: 'OWNER' | 'STAFF';
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
  memberships: AuthMembership[];
}

export interface RegisterRequest {
  businessName: string;
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
