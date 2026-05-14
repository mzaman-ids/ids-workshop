import type {User as IUser} from '@ids/data-models';
import {StringNormalizer} from '../common/normalizers/string.normalizer';
import type {UserResponseDto} from './dto/user-response.dto';

export function toUserDto(user: IUser): UserResponseDto {
  return {
    id: user.id,
    logtoUserId: user.logtoUserId,
    email: user.email,
    username: StringNormalizer.toTrimmedOrNull(user.username),
    nickname: StringNormalizer.toTrimmedOrNull(user.nickname),
    displayName: StringNormalizer.toTrimmedOrNull(user.displayName),
    bio: StringNormalizer.toTrimmedOrNull(user.bio),
    preferredLanguage: StringNormalizer.toTrimmedOrNull(user.preferredLanguage),
    timezone: StringNormalizer.toTrimmedOrNull(user.timezone),
    emailNotifications: user.emailNotifications,
    smsNotifications: user.smsNotifications,
    marketingEmails: user.marketingEmails,
    profileCompleteness: user.profileCompleteness,
    lastLoginAt: user.lastLoginAt ?? null,
    hasProfilePhoto: user.hasProfilePhoto ?? false,
    isDeleted: user.isDeleted ?? false,
    createdDate: user.createdDate,
    updatedDate: user.updatedDate,
  };
}

export function toUserDtoList(users: IUser[]): UserResponseDto[] {
  return users.map(toUserDto);
}
