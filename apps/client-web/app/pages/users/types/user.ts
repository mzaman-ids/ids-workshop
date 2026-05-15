export type SalespersonListItem = {
  id: string;
  displayName: string;
  email: string;
};

export type UserProfile = {
  id: string;
  logtoUserId: string;
  email: string;
  username: string | null;
  nickname: string | null;
  displayName: string | null;
  bio: string | null;
  preferredLanguage: string | null;
  timezone: string | null;
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  profileCompleteness: number;
  lastLoginAt: string | null;
  hasProfilePhoto: boolean;
  isDeleted: boolean;
  createdDate: string;
  updatedDate: string;
};

export type UpdateUserInput = {
  displayName?: string | null;
  nickname?: string | null;
  bio?: string | null;
  timezone?: string | null;
  preferredLanguage?: string | null;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  marketingEmails?: boolean;
};

export type CreateUserInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username?: string;
};

export type UserListCriteria = {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  isDeleted?: boolean;
  signal?: AbortSignal;
  token: string;
};

export type UserListResponse = {
  items: UserProfile[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type UserSearchCriteria = {
  searchTerm?: string;
};
